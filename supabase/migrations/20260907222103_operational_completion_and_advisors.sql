-- Findings from Supabase advisors, 2026-09-07 UTC.
alter policy member_read on public.memberships using(user_id=(select auth.uid()) or private.member_id(organization_id) is not null);
drop index public.allocation_doc;
-- Internal event/secret tables intentionally deny every API role.
create policy internal_only on public.outbox_events for all to authenticated using(false) with check(false);
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='private' loop execute format('create policy internal_only on private.%I for all to authenticated using(false) with check(false)',r.tablename);end loop;end$$;
-- Add only foreign-key indexes without an existing complete leading key.
do $$declare fk record;cols text;begin
 for fk in select c.*,n.nspname,t.relname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 where c.contype='f' and n.nspname in('public','private') and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indpred is null and i.indkey::smallint[] @> c.conkey and (select array_agg(v order by k) from unnest(i.indkey::smallint[]) with ordinality x(v,k) where k<=cardinality(c.conkey))=c.conkey)
 loop select string_agg(quote_ident(a.attname),',' order by x.k) into cols from unnest(fk.conkey) with ordinality x(num,k) join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=x.num;
 execute format('create index %I on %I.%I(%s)','fk_'||substr(md5(fk.nspname||fk.conname),1,20),fk.nspname,fk.relname,cols);
 end loop;end$$;
create table public.tool_units(organization_id uuid not null,tool_id uuid not null,unit_number int not null,state text not null default 'active' check(state in('active','broken','inactive')),version bigint not null default 1,primary key(organization_id,tool_id,unit_number),foreign key(organization_id,tool_id) references public.tools(organization_id,id));
insert into public.tool_units(organization_id,tool_id,unit_number) select t.organization_id,t.id,n from public.tools t cross join lateral generate_series(1,t.capacity)n where t.kind='physical';
alter table public.tool_units enable row level security;revoke all on public.tool_units from anon,authenticated;grant select on public.tool_units to authenticated;
create policy units_read on public.tool_units for select to authenticated using(private.member_id(organization_id) is not null);
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
 insert into public.meetings(id,organization_id,created_by,deal_id,customer_id,title,kind,location,url,starts_at,ends_at,agenda,outcome)
 values(rid,org,m,nullif(payload->>'deal_id','')::uuid,nullif(payload->>'customer_id','')::uuid,payload->>'title',payload->>'kind',payload->>'location',nullif(payload->>'url',''),(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,payload->>'agenda',payload->>'outcome')
 on conflict(id) do update set title=excluded.title,location=excluded.location,url=excluded.url,starts_at=excluded.starts_at,ends_at=excluded.ends_at,agenda=excluded.agenda,outcome=excluded.outcome,cancelled=coalesce((payload->>'cancelled')::boolean,meetings.cancelled),version=meetings.version+1 where meetings.organization_id=org;
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

alter table public.work_items add column catalog_snapshot jsonb;
create function private.work_catalog_snapshot() returns trigger language plpgsql set search_path='' as $$declare c public.service_catalog;begin
 if new.catalog_id is not null then
 select * into c from public.service_catalog where organization_id=new.organization_id and id=new.catalog_id and not archived;
 if c.id is null then raise exception 'INVALID_CATALOG_SERVICE';end if;
 new.catalog_snapshot:=jsonb_build_object('name',c.name,'description',c.description,'version',c.version);
 end if;return new;end;$$;
create trigger work_catalog_snapshot before insert on public.work_items for each row execute function private.work_catalog_snapshot();
create function private.work_catalog_tasks() returns trigger language plpgsql set search_path='' as $$declare item jsonb;begin
 if new.kind='service' and new.catalog_id is not null then
 for item in select jsonb_array_elements(task_templates) from public.service_catalog where organization_id=new.organization_id and id=new.catalog_id loop
 insert into public.work_items(organization_id,deal_id,kind,parent_service_id,name,department_id,assignee_id,due_at)
 values(new.organization_id,new.deal_id,'task',new.id,item->>'name',new.department_id,new.assignee_id,new.due_at);
 end loop;end if;return new;end;$$;
create trigger work_catalog_tasks after insert on public.work_items for each row execute function private.work_catalog_tasks();
create or replace function private.validate_deal(org uuid,d uuid) returns void language plpgsql set search_path='' as $$
declare x public.deals; w public.work_items; total bigint;begin
 select * into x from public.deals where organization_id=org and id=d;
 if not exists(select 1 from public.pipeline_stages where organization_id=org and code=x.stage and pipeline=x.pipeline) then raise exception 'INVALID_STAGE';end if;
 if x.accountable_id is not null and not exists(select 1 from public.memberships where organization_id=org and id=x.accountable_id and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 if x.location_id is not null and not exists(select 1 from public.customer_locations where organization_id=org and id=x.location_id and customer_id=x.customer_id) then raise exception 'LOCATION_CUSTOMER_MISMATCH';end if;
 for w in select * from public.work_items where organization_id=org and deal_id=d and not archived loop
 if w.due_at>x.due_at then raise exception 'CHILD_DEADLINE_EXCEEDS_PARENT';end if;
 if w.assignee_id is not null and not exists(select 1 from public.memberships where organization_id=org and id=w.assignee_id and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 if not exists(select 1 from public.departments where organization_id=org and id=w.department_id and not archived) then raise exception 'INACTIVE_DEPARTMENT';end if;
 if w.parent_service_id is not null and not exists(select 1 from public.work_items where organization_id=org and id=w.parent_service_id and deal_id=d and kind='service') then raise exception 'INVALID_PARENT_SERVICE';end if;
 if w.parent_service_id is not null and exists(select 1 from public.work_items parent where parent.organization_id=org and parent.id=w.parent_service_id and (parent.archived or w.due_at>parent.due_at)) then raise exception 'CHILD_DEADLINE_EXCEEDS_PARENT';end if;
 end loop;
 if x.first_confirmed_at is not null or x.pipeline='recurring' or x.stage in('confirmed','in_progress','delivered') then
 total:=private.total(org,d);
 if x.customer_id is null or x.due_at is null or total is null then raise exception 'CONFIRMATION_FIELDS_REQUIRED';end if;
 if exists(select 1 from public.work_items where organization_id=org and deal_id=d and not archived and (assignee_id is null or due_at is null)) then raise exception 'WORK_FIELDS_REQUIRED';end if;
 if total=0 and nullif(trim(x.zero_reason),'') is null then raise exception 'ZERO_REASON_REQUIRED';end if;
 end if;
end;$$;
create or replace function private.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; d uuid; w uuid; x public.deals; old_work public.work_items; item jsonb; prior private.requests; result jsonb; num bigint; yr int; amount_changed boolean:=false; open_ids uuid[]; old_price bigint;begin
 m:=private.require_member(org);
 -- Lock ordering is tenant -> deal -> money. This also serializes permission revocation with writes.
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=crm_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if operation='deal.create' then
 if payload ?| array['created_by','accountable_id','creation_source','stage','total','organization_id'] then raise exception 'FORBIDDEN_FIELD';end if;
 if jsonb_array_length(coalesce(payload->'works','[]'))=0 or nullif(payload->>'customer_id','') is null then raise exception 'CUSTOMER_AND_WORK_REQUIRED';end if;
 yr:=extract(year from now() at time zone 'Asia/Baku');
 insert into private.serials values(org,yr,1) on conflict(organization_id,year) do update set value=private.serials.value+1 returning value into num;
 insert into public.deals(organization_id,serial,title,customer_id,location_id,created_by,accountable_id,creation_source,due_at,zero_reason)
 values(org,'CRM-'||yr||'-'||lpad(num::text,6,'0'),nullif(trim(payload->>'title'),''),(payload->>'customer_id')::uuid,nullif(payload->>'location_id','')::uuid,m,m,'manual',nullif(payload->>'due_at','')::timestamptz,payload->>'zero_reason') returning * into x;d:=x.id;
 for item in select * from jsonb_array_elements(payload->'works') loop
 if item->>'amount' is not null and not private.permitted(org,'commercials.write') then raise exception 'COMMERCIAL_WRITE_REQUIRED' using errcode='42501';end if;
 insert into public.work_items(organization_id,deal_id,name,department_id,assignee_id,catalog_id,due_at,billing_interval)
 values(org,d,item->>'name',(item->>'department_id')::uuid,coalesce(nullif(item->>'assignee_id','')::uuid,m),nullif(item->>'catalog_id','')::uuid,nullif(item->>'due_at','')::timestamptz,coalesce(item->>'billing_interval','once')) returning id into w;
 insert into public.work_prices values(org,w,nullif(item->>'amount','')::bigint);
 end loop;
 else
 d:=(payload->>'deal_id')::uuid;
 select * into x from public.deals where organization_id=org and id=d for update;
 if x.id is null or not private.can_read_deal(org,d) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if x.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation not in('work.status','comment.add') and not private.can_edit_deal(org,d) then raise exception 'EDIT_DENIED' using errcode='42501';end if;
 if operation='deal.stage' then
 if x.stage in('delivered','lost','recurring_done') and x.stage is distinct from payload->>'stage' and nullif(trim(payload->>'reason'),'') is null then raise exception 'REOPEN_REASON_REQUIRED';end if;
 if payload->>'stage'='lost' and not exists(select 1 from public.loss_reasons where organization_id=org and id=nullif(payload->>'loss_reason_id','')::uuid and not archived) then raise exception 'LOSS_REASON_REQUIRED';end if;
 select array_agg(id) into open_ids from public.work_items where organization_id=org and deal_id=d and not archived and status<>'done';
 if payload->>'stage'='recurring_done' and cardinality(open_ids)>0 and nullif(trim(payload->>'reason'),'') is null then raise exception 'OPEN_WORK_REASON_REQUIRED';end if;
 update public.deals set stage=payload->>'stage',loss_reason_id=case when payload->>'stage'='lost' then (payload->>'loss_reason_id')::uuid else loss_reason_id end,
 completion_reason=case when payload->>'stage'='recurring_done' then payload->>'reason' else completion_reason end,
 open_work_snapshot=case when payload->>'stage'='recurring_done' then coalesce(open_ids,'{}') else open_work_snapshot end,
 first_confirmed_at=case when payload->>'stage' in('confirmed','in_progress','delivered') then coalesce(first_confirmed_at,now()) else first_confirmed_at end,
 delivered_at=case when payload->>'stage' in('delivered','recurring_done') then coalesce(delivered_at,now()) else delivered_at end where id=d;
 elsif operation='deal.update' then
 if payload ?| array['created_by','creation_source','pipeline','stage','total'] then raise exception 'FORBIDDEN_FIELD';end if;
 if payload ? 'due_at' and x.due_at is distinct from nullif(payload->>'due_at','')::timestamptz and nullif(trim(payload->>'reason'),'') is null then raise exception 'DEADLINE_REASON_REQUIRED';end if;
 if x.first_confirmed_at is not null and payload ? 'customer_id' and x.customer_id is distinct from (payload->>'customer_id')::uuid then raise exception 'CONFIRMED_CUSTOMER_IMMUTABLE';end if;
 update public.deals set title=case when payload ? 'title' then payload->>'title' else title end,
 customer_id=case when payload ? 'customer_id' then (payload->>'customer_id')::uuid else customer_id end,
 location_id=case when payload ? 'location_id' then nullif(payload->>'location_id','')::uuid else location_id end,
 accountable_id=case when payload ? 'accountable_id' then (payload->>'accountable_id')::uuid else accountable_id end,
 due_at=case when payload ? 'due_at' then nullif(payload->>'due_at','')::timestamptz else due_at end,
 zero_reason=coalesce(payload->>'zero_reason',zero_reason),archived=coalesce((payload->>'archived')::boolean,archived) where id=d;
 elsif operation='participant.set' then
 if not exists(select 1 from public.memberships where organization_id=org and id=(payload->>'member_id')::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 if (payload->>'enabled')::boolean then insert into public.deal_members values(org,d,(payload->>'member_id')::uuid) on conflict do nothing;
 else delete from public.deal_members where organization_id=org and deal_id=d and member_id=(payload->>'member_id')::uuid;end if;
 elsif operation in('work.save','work.status') then
 w:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select * into old_work from public.work_items where organization_id=org and deal_id=d and id=w;
 if operation='work.status' then
 if payload - array['deal_id','id','status'] <> '{}'::jsonb then raise exception 'FORBIDDEN_FIELD';end if;
 if old_work.id is null or (old_work.assignee_id is distinct from m and not private.can_edit_deal(org,d)) then raise exception 'OWN_WORK_ONLY' using errcode='42501';end if;
 update public.work_items set status=payload->>'status',version=version+1 where id=w;
 else
 if old_work.id is not null and payload ? 'due_at' and old_work.due_at is distinct from nullif(payload->>'due_at','')::timestamptz and nullif(trim(payload->>'reason'),'') is null then raise exception 'DEADLINE_REASON_REQUIRED';end if;
 amount_changed:=payload ? 'amount' or old_work.id is null and coalesce(payload->>'kind','service')='service' or payload ? 'archived' and coalesce(old_work.kind,'service')='service';
 if amount_changed and not (private.is_admin(org) or private.can_edit_deal(org,d) and private.permitted(org,'commercials.write')) then raise exception 'COMMERCIAL_WRITE_REQUIRED' using errcode='42501';end if;
 if old_work.id is null then
 insert into public.work_items(id,organization_id,deal_id,kind,parent_service_id,catalog_id,name,description,department_id,assignee_id,due_at,billing_interval)
 values(w,org,d,coalesce(payload->>'kind','service'),nullif(payload->>'parent_service_id','')::uuid,nullif(payload->>'catalog_id','')::uuid,payload->>'name',payload->>'description',(payload->>'department_id')::uuid,nullif(payload->>'assignee_id','')::uuid,nullif(payload->>'due_at','')::timestamptz,coalesce(payload->>'billing_interval','once'));
 else
 update public.work_items set name=coalesce(payload->>'name',name),description=coalesce(payload->>'description',description),
 department_id=coalesce(nullif(payload->>'department_id','')::uuid,department_id),assignee_id=case when payload ? 'assignee_id' then nullif(payload->>'assignee_id','')::uuid else assignee_id end,
 due_at=case when payload ? 'due_at' then nullif(payload->>'due_at','')::timestamptz else due_at end,archived=coalesce((payload->>'archived')::boolean,archived),version=version+1 where id=w;
 end if;
 if coalesce(old_work.kind,payload->>'kind','service')='service' and (payload ? 'amount' or old_work.id is null) then
 select amount into old_price from public.work_prices where organization_id=org and work_id=w;
 insert into public.work_prices values(org,w,nullif(payload->>'amount','')::bigint) on conflict(organization_id,work_id) do update set amount=excluded.amount;
 perform private.emit(org,d,'price.changed',x.version+1,jsonb_build_object('amount',old_price),jsonb_build_object('amount',nullif(payload->>'amount','')::bigint),payload->>'reason','commercial');
 end if;
 end if;
 elsif operation='comment.add' then
 insert into public.deal_comments(organization_id,deal_id,actor_id,body) values(org,d,m,payload->>'body');
 else raise exception 'UNKNOWN_OPERATION';end if;
 update public.deals set version=version+1 where id=d;
 end if;
 perform private.validate_deal(org,d);
 select * into x from public.deals where id=d;
 perform private.sync_charge(org,d,payload->>'reason',coalesce((payload->>'reconcile')::boolean,false));
 if x.pipeline='sales' and x.first_confirmed_at is not null then
 insert into public.portfolio_items(organization_id,deal_id,status) values(org,d,case x.stage when 'delivered' then 'completed' when 'lost' then 'archived' else 'draft' end)
 on conflict(organization_id,deal_id) do update set status=excluded.status;end if;
 perform private.emit(org,d,operation,x.version,null,jsonb_build_object('stage',x.stage,'version',x.version,'open_work_ids',x.open_work_snapshot),payload->>'reason');
 result:=jsonb_build_object('id',d,'version',x.version,'work_id',w);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;
