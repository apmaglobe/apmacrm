create function private.todo_items(org uuid,scope text,search text,skip_rows int) returns setof public.work_items language plpgsql stable security definer set search_path='' as $$
declare m uuid:=private.require_member(org);admin boolean:=private.is_admin(org);begin
 if scope not in('mine','own','shared','team') or scope='team' and not admin then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 return query with shared as materialized(
 select d.id from public.deals d where d.organization_id=org and m in(d.created_by,d.accountable_id)
 union select dm.deal_id from public.deal_members dm where dm.organization_id=org and dm.member_id=m
 union select w.deal_id from public.work_items w where w.organization_id=org and not w.archived and w.assignee_id=m
 ) select w.* from public.work_items w where w.organization_id=org and not w.archived and (scope='team' and admin or scope in('mine','own') and w.assignee_id=m or scope='shared' and w.deal_id in(select id from shared))
 and strpos(lower(w.name),lower(left(coalesce(search,''),120)))>0 order by w.due_at asc nulls last,w.id offset greatest(skip_rows,0) limit 200;
end;$$;
create function public.todo_items(org uuid,scope text default 'mine',search text default '',skip_rows int default 0) returns setof public.work_items language sql stable security invoker set search_path='' as $$select * from private.todo_items(org,scope,search,skip_rows);$$;
revoke all on function private.todo_items(uuid,text,text,int),public.todo_items(uuid,text,text,int) from public,anon;
grant execute on function private.todo_items(uuid,text,text,int),public.todo_items(uuid,text,text,int) to authenticated;

create or replace function private.operations_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid;rid uuid;cid uuid;prior private.requests;result jsonb;t public.tools;r public.tool_reservations;mt public.meetings;msg public.messages;c public.conversations;occupied int;mid text;begin
 m:=private.require_member(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=operations_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if operation='tool.save' then
 perform private.require_admin(org);select * into t from public.tools where organization_id=org and id=rid for update;
 if t.id is not null and t.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if t.id is not null and t.capacity>(payload->>'capacity')::int and exists(select 1 from public.tool_reservations where organization_id=org and tool_id=rid and not cancelled and returned_at is null) then raise exception 'ACTIVE_RESERVATIONS_CAPACITY';end if;
 insert into public.tools(id,organization_id,name,kind,capacity,state) values(rid,org,payload->>'name',payload->>'kind',(payload->>'capacity')::int,coalesce(payload->>'state','active'))
 on conflict(id) do update set name=excluded.name,capacity=excluded.capacity,state=excluded.state,version=tools.version+1 where tools.organization_id=org;
 insert into public.tool_units(organization_id,tool_id,unit_number) select org,rid,n from generate_series(1,(payload->>'capacity')::int)n where coalesce(t.kind,payload->>'kind')='physical' on conflict do nothing;
 elsif operation='tool.unit' then
 perform private.require_admin(org);
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 update public.tool_units set state=payload->>'state',version=version+1 where organization_id=org and tool_id=(payload->>'tool_id')::uuid and unit_number=(payload->>'unit_number')::int and version=expected_version;
 if not found then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 elsif operation='tool.reserve' then
 select * into t from public.tools where organization_id=org and id=(payload->>'tool_id')::uuid for update;
 if t.id is null or t.state<>'active' then raise exception 'TOOL_UNAVAILABLE';end if;
 if (payload->>'ends_at')::timestamptz<=(payload->>'starts_at')::timestamptz then raise exception 'INVALID_INTERVAL';end if;
 if t.kind='physical' and (nullif(payload->>'unit_number','')::int not between 1 and t.capacity or payload->>'unit_number' is null or coalesce((payload->>'quantity')::int,1)<>1) then raise exception 'PHYSICAL_UNIT_REQUIRED';end if;
 if t.kind='physical' and not exists(select 1 from public.tool_units where organization_id=org and tool_id=t.id and unit_number=(payload->>'unit_number')::int and state='active') then raise exception 'TOOL_UNIT_UNAVAILABLE';end if;
 -- Count peak concurrent occupancy at interval boundaries, not sum of non-overlapping reservations.
 select coalesce(max(load),0) into occupied from (
 select sum(q.quantity)::int load from public.tool_reservations q
 join (select (payload->>'starts_at')::timestamptz at union select starts_at from public.tool_reservations where organization_id=org and tool_id=t.id and starts_at>=(payload->>'starts_at')::timestamptz and starts_at<(payload->>'ends_at')::timestamptz) points
 on q.starts_at<=points.at and (q.ends_at>points.at or q.checked_out_at is not null and q.returned_at is null)
 where q.organization_id=org and q.tool_id=t.id and not q.cancelled and q.returned_at is null and (t.kind='digital' or q.unit_number=(payload->>'unit_number')::int) group by points.at) loads;
 if occupied+coalesce((payload->>'quantity')::int,1)>(case when t.kind='physical' then 1 else t.capacity end) then raise exception 'TOOL_CAPACITY_CONFLICT';end if;
 insert into public.tool_reservations(id,organization_id,tool_id,member_id,starts_at,ends_at,quantity,unit_number)
 values(rid,org,t.id,m,(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,coalesce((payload->>'quantity')::int,1),nullif(payload->>'unit_number','')::int);
 elsif operation in('tool.checkout','tool.return','tool.cancel') then
 select * into r from public.tool_reservations where organization_id=org and id=rid for update;
 if r.id is null or not(private.is_admin(org) or r.member_id=m) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if r.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation='tool.checkout' then
 if r.cancelled or r.returned_at is not null or now()<r.starts_at or now()>=r.ends_at then raise exception 'INVALID_CHECKOUT';end if;
 select * into t from public.tools where organization_id=org and id=r.tool_id for update;
 if t.kind='physical' and not exists(select 1 from public.tool_units where organization_id=org and tool_id=t.id and unit_number=r.unit_number and state='active') then raise exception 'TOOL_UNIT_UNAVAILABLE';end if;
 if t.state<>'active' or r.quantity+(select coalesce(sum(quantity),0) from public.tool_reservations where organization_id=org and tool_id=r.tool_id and id<>rid and checked_out_at is not null and returned_at is null and (t.kind='digital' or unit_number=r.unit_number))>(case when t.kind='physical' then 1 else t.capacity end) then raise exception 'TOOL_NOT_RETURNED';end if;
 update public.tool_reservations set checked_out_at=coalesce(checked_out_at,now()),version=version+1 where id=rid;
 elsif operation='tool.return' then if r.checked_out_at is null then raise exception 'NOT_CHECKED_OUT';end if;update public.tool_reservations set returned_at=coalesce(returned_at,now()),version=version+1 where id=rid;
 else if r.checked_out_at is not null and r.returned_at is null then raise exception 'RETURN_REQUIRED';end if;update public.tool_reservations set cancelled=true,version=version+1 where id=rid;end if;
 elsif operation='link.save' then
 if not private.can_edit_deal(org,(payload->>'deal_id')::uuid) then raise exception 'EDIT_DENIED' using errcode='42501';end if;
 if exists(select 1 from public.resource_links where organization_id=org and id=rid and (version<>expected_version or deal_id<>(payload->>'deal_id')::uuid)) then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 insert into public.resource_links(id,organization_id,deal_id,title,url,category,created_by) values(rid,org,(payload->>'deal_id')::uuid,payload->>'title',payload->>'url',payload->>'category',m)
 on conflict(id) do update set title=excluded.title,url=excluded.url,category=excluded.category,archived=coalesce((payload->>'archived')::boolean,resource_links.archived),version=resource_links.version+1 where resource_links.organization_id=org;
 elsif operation='meeting.save' then
 select * into mt from public.meetings where organization_id=org and id=rid for update;
 if mt.id is not null and (mt.created_by<>m and not private.is_admin(org)) then raise exception 'EDIT_DENIED' using errcode='42501';end if;
 if mt.id is not null and mt.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if nullif(payload->>'deal_id','') is not null and not private.can_read_deal(org,(payload->>'deal_id')::uuid) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if nullif(payload->>'deal_id','') is not null and nullif(payload->>'customer_id','') is not null and not exists(select 1 from public.deals d where d.organization_id=org and d.id=(payload->>'deal_id')::uuid and d.customer_id=(payload->>'customer_id')::uuid) then raise exception 'DEAL_CUSTOMER_MISMATCH';end if;
 insert into public.meetings(id,organization_id,created_by,deal_id,customer_id,title,kind,location,url,starts_at,ends_at,agenda,outcome)
 values(rid,org,m,nullif(payload->>'deal_id','')::uuid,nullif(payload->>'customer_id','')::uuid,payload->>'title',payload->>'kind',payload->>'location',nullif(payload->>'url',''),(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,payload->>'agenda',payload->>'outcome')
 on conflict(id) do update set kind=excluded.kind,deal_id=excluded.deal_id,customer_id=excluded.customer_id,title=excluded.title,location=excluded.location,url=excluded.url,starts_at=excluded.starts_at,ends_at=excluded.ends_at,agenda=excluded.agenda,outcome=excluded.outcome,cancelled=coalesce((payload->>'cancelled')::boolean,meetings.cancelled),version=meetings.version+1 where meetings.organization_id=org;
 delete from public.meeting_participants where organization_id=org and meeting_id=rid;
 for mid in select jsonb_array_elements_text(coalesce(payload->'participants','[]')) loop
 if not exists(select 1 from public.memberships where organization_id=org and id=mid::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 insert into public.meeting_participants values(org,rid,mid::uuid);end loop;
 elsif operation='conversation.create' then
 insert into public.conversations(id,organization_id,title,created_by) values(rid,org,payload->>'title',m);
 insert into public.conversation_members(organization_id,conversation_id,member_id) values(org,rid,m);
 for mid in select jsonb_array_elements_text(coalesce(payload->'members','[]')) loop
 if not exists(select 1 from public.memberships where organization_id=org and id=mid::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 insert into public.conversation_members(organization_id,conversation_id,member_id) values(org,rid,mid::uuid) on conflict do nothing;end loop;
 elsif operation in('conversation.member','conversation.read') then
 cid:=(payload->>'conversation_id')::uuid;if private.chat_joined(org,cid) is null then raise exception 'CHAT_ACCESS_DENIED' using errcode='42501';end if;
 if operation='conversation.read' then update public.conversation_members set read_at=now() where organization_id=org and conversation_id=cid and member_id=m;
 else select * into c from public.conversations where organization_id=org and id=cid for update;
 if c.created_by<>m then raise exception 'CHAT_OWNER_REQUIRED' using errcode='42501';end if;
 if c.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if (payload->>'enabled')::boolean then
 if not exists(select 1 from public.memberships where organization_id=org and id=(payload->>'member_id')::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 insert into public.conversation_members(organization_id,conversation_id,member_id) values(org,cid,(payload->>'member_id')::uuid)
 on conflict(organization_id,conversation_id,member_id) do update set joined_at=now(),removed_at=null where conversation_members.removed_at is not null;
 else update public.conversation_members set removed_at=now() where organization_id=org and conversation_id=cid and member_id=(payload->>'member_id')::uuid;end if;
 update public.conversations set version=version+1 where id=cid;
 perform realtime.send(jsonb_build_object('event_id',gen_random_uuid(),'access_changed',true),'invalidate','member:'||(select user_id::text from public.memberships where organization_id=org and id=(payload->>'member_id')::uuid),true);end if;
 elsif operation in('message.send','message.edit') then
 cid:=(payload->>'conversation_id')::uuid;if private.chat_joined(org,cid) is null then raise exception 'CHAT_ACCESS_DENIED' using errcode='42501';end if;
 if operation='message.send' then
 if nullif(trim(payload->>'body'),'') is null then raise exception 'MESSAGE_REQUIRED';end if;
 insert into public.messages(id,organization_id,conversation_id,author_id,body) values(rid,org,cid,m,payload->>'body');
 else
 select * into msg from public.messages where organization_id=org and conversation_id=cid and id=rid for update;
 if msg.author_id is distinct from m or msg.created_at<now()-interval '15 minutes' then raise exception 'MESSAGE_EDIT_WINDOW' using errcode='42501';end if;
 if msg.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 insert into private.message_edits(organization_id,message_id,previous_body) values(org,rid,msg.body);
 update public.messages set body=case when (payload->>'deleted')::boolean then '' else payload->>'body' end,deleted=coalesce((payload->>'deleted')::boolean,false),version=version+1 where id=rid;end if;
 elsif operation='notification.read' then update public.notifications set read_at=now() where organization_id=org and id=rid and recipient_id=m;
 else raise exception 'UNKNOWN_OPERATION';end if;
 result:=jsonb_build_object('id',rid);
 if operation not like 'message.%' and operation not like 'conversation.%' then
 insert into public.audit_events(organization_id,deal_id,actor_id,action,visibility,after_data) values(org,nullif(payload->>'deal_id','')::uuid,auth.uid(),operation,case when payload->>'deal_id' is null then 'admin' else 'object' end,result);end if;
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,case when cid is not null then 'chat' else 'operations' end,coalesce(cid,rid));
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;

create or replace function private.run_worker_v1() returns int language plpgsql security definer set search_path='' as $$declare c record;e public.webhook_events;ep public.webhook_endpoints;customer uuid;d uuid;num bigint;yr int;n int:=0;j uuid;generated uuid;begin
 for c in select sc.organization_id,sc.id,sc.next_period_start from public.service_contracts sc
 where sc.status='active' and sc.next_period_start<=(now() at time zone 'Asia/Baku')::date and (sc.end_date is null or sc.next_period_start<=sc.end_date)
 and not exists(select 1 from public.job_runs jr where jr.organization_id=sc.organization_id and jr.type='recurring' and jr.dedupe_key=sc.id::text||':'||sc.next_period_start::text and jr.run_after>now())
 order by sc.next_period_start,sc.organization_id,sc.id limit 30 loop
 perform pg_advisory_xact_lock(hashtextextended(c.organization_id::text,0));
 insert into public.job_runs(organization_id,type,dedupe_key,payload,status,attempts,locked_until) values(c.organization_id,'recurring',c.id::text||':'||c.next_period_start::text,jsonb_build_object('contract_id',c.id,'period_start',c.next_period_start),'running',1,now()+interval '2 minutes')
 on conflict(organization_id,type,dedupe_key) do update set status='running',attempts=job_runs.attempts+1,locked_until=now()+interval '2 minutes' returning id into j;
 generated:=private.generate_period(c.organization_id,c.id);
 update public.job_runs set status=case when generated is null then 'failed' else 'done' end,locked_until=null,
 last_error=case when generated is null then coalesce((select last_error from public.contract_periods where organization_id=c.organization_id and contract_id=c.id and period_start=c.next_period_start),'GENERATION_NOT_READY') end,
 run_after=case when generated is null then now()+make_interval(mins=>least(60,greatest(1,attempts*2))) else now() end,result=jsonb_build_object('deal_id',generated) where id=j;
 n:=n+1;end loop;
 for e in select * from public.webhook_events where status in('queued','failed') and attempts<5 order by created_at limit 30 for update skip locked loop
 begin
 select * into ep from public.webhook_endpoints where id=e.endpoint_id;
 if not exists(select 1 from public.memberships where organization_id=e.organization_id and id=ep.default_admin_id and is_admin and status='active') then raise exception 'DEFAULT_ADMIN_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock(hashtextextended(e.organization_id::text,0));
 select id into customer from public.customers where organization_id=e.organization_id and external_id=e.payload->>'customer_external_id';
 yr:=extract(year from now() at time zone 'Asia/Baku');
 insert into private.serials values(e.organization_id,yr,1) on conflict(organization_id,year) do update set value=private.serials.value+1 returning value into num;
 insert into public.deals(organization_id,serial,title,customer_id,accountable_id,creation_source,intake_department_id,intake)
 values(e.organization_id,'CRM-'||yr||'-'||lpad(num::text,6,'0'),e.payload->>'company_name',customer,ep.default_admin_id,'webhook',ep.department_id,e.payload) returning id into d;
 update public.webhook_events set status='done',deal_id=d,attempts=attempts+1,last_error=null where id=e.id;perform private.emit(e.organization_id,d,'webhook.created',1);n:=n+1;
 exception when others then update public.webhook_events set status='failed',last_error=sqlerrm,attempts=attempts+1 where id=e.id;end;end loop;
 -- Source version is part of the key: old deadlines no longer generate new notifications.
 insert into public.notifications(organization_id,recipient_id,deal_id,event_key,label)
 select w.organization_id,w.assignee_id,w.deal_id,'deadline:'||w.id||':'||w.version||':'||h.hours,'İşin deadline-ı yaxınlaşır'
 from public.work_items w cross join(values(24),(2)) h(hours) join public.memberships m on m.id=w.assignee_id and m.organization_id=w.organization_id and m.status='active'
 where not w.archived and w.status<>'done' and w.due_at between now()+make_interval(hours=>h.hours)-interval '1 minute' and now()+make_interval(hours=>h.hours)
 on conflict do nothing;
 return n;end;$$;

create or replace function private.export_snapshot(org uuid,m text,filters jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text; result jsonb:='[]';rows jsonb;clause text;parent text;parent_key text;ids jsonb;search text:=left(coalesce(filters->>'q',''),120);begin
 perform private.export_access(org,m);
 foreach t in array private.export_tables(m) loop
 clause:=private.export_predicate(t);parent:=null;parent_key:=null;
 if t='work_items' and m='crm' then parent:='deal_cards';parent_key:='deal_id';
 elsif t='work_prices' then parent:='work_items';parent_key:='work_id';
 elsif t in('customer_locations','contacts') then parent:='customers';parent_key:='customer_id';end if;
 if parent is not null then
 select coalesce(jsonb_agg(row->>'id'),'[]') into ids from jsonb_array_elements(result) part cross join lateral jsonb_array_elements(part->'rows') row where part->>'table'=parent;
 clause:=clause||format(' and r.%I::text in(select jsonb_array_elements_text(%L::jsonb))',parent_key,ids::text);
 elsif search<>'' and t in('customers','deal_cards','work_items','tools','meetings','resource_links','memberships','service_contracts','financial_documents','payments') then
 clause:=clause||format(' and strpos(lower(coalesce(r.%I,'''')),lower(%L))>0',case when t in('deal_cards','meetings','resource_links','service_contracts') then 'title' when t='financial_documents' then 'counterparty' when t='payments' then 'note' else 'name' end,search);
 end if;
 if t='portfolio_items' and search<>'' then clause:=clause||format(' and exists(select 1 from public.deals d where d.organization_id=r.organization_id and d.id=r.deal_id and strpos(lower(coalesce(d.title,'''')),lower(%L))>0)',search);end if;
 if t in('customers','work_items') then clause:=clause||' and not r.archived';end if;
 if t='deal_cards' then clause:=clause||replace(private.deal_filter_sql(filters),'d.','r.');end if;
 if t='deal_cards' and filters->>'pipeline' in('sales','recurring') then clause:=clause||format(' and r.pipeline=%L',filters->>'pipeline');end if;
 if m='todo' and filters->>'scope'='shared' then clause:=clause||' and private.participates(r.organization_id,r.deal_id)';end if;
 if m='todo' and coalesce(filters->>'scope','own')<>'shared' and not (private.is_admin(org) and filters->>'scope'='team') then clause:=clause||format(' and r.assignee_id=%L::uuid',private.member_id(org));end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)-array[''user_id'',''overrides'',''join_token'',''template_snapshot'',''intake''] order by r.%I),''[]'') from public.%I r where r.organization_id=$1 and (%s)',case when t='work_prices' then 'work_id' else 'id' end,t,clause) into rows using org;
 -- The definer context must not make view-derived price columns bypass field permission.
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
 select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 result:=result||jsonb_build_array(jsonb_build_object('table',t,'rows',rows));
 end loop;return result;
end;$$;
