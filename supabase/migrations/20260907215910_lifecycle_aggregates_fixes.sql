-- Lifecycle snapshots never change billing or cash history.
alter table public.contract_periods add column service_last_day date;
create or replace function private.drain_periods(org uuid,contract uuid) returns void language plpgsql set search_path='' as $$
declare c public.service_contracts;before_date date;begin
 for i in 1..1200 loop
 select * into c from public.service_contracts where organization_id=org and id=contract for update;
 if c.status<>'active' or c.next_period_start>(now() at time zone 'Asia/Baku')::date or c.end_date is not null and c.next_period_start>c.end_date then return;end if;
 before_date:=c.next_period_start;
 if private.generate_period(org,contract) is null then raise exception 'PERIOD_GENERATION_BLOCKED';end if;
 end loop;
 raise exception 'PERIOD_BACKLOG_LIMIT';end;$$;
create or replace function private.subscription_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.service_contracts;rid uuid;prior private.requests;result jsonb;settings jsonb;nextday date;d uuid;begin
 perform private.require_admin(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=subscription_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select * into c from public.service_contracts where organization_id=org and id=rid for update;
 if c.id is not null and c.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation='contract.save' then
 if c.id is not null and nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 -- Drain already-started periods using the old revision before changing future terms.
 if c.id is not null then perform private.drain_periods(org,c.id);end if;
 insert into public.service_contracts(id,organization_id,customer_id,source_deal_id,title,category,billing_day,first_payment_date,end_date,next_period_start)
 values(rid,org,(payload->>'customer_id')::uuid,nullif(payload->>'source_deal_id','')::uuid,payload->>'title',coalesce(payload->>'category','monthly_service'),(payload->>'billing_day')::int,(payload->>'first_payment_date')::date,nullif(payload->>'end_date','')::date,(payload->>'first_payment_date')::date)
 on conflict(id) do update set title=excluded.title,end_date=excluded.end_date,version=service_contracts.version+1 where service_contracts.organization_id=org returning * into c;
 settings:=jsonb_build_object('works',payload->'works','accountable_id',payload->>'accountable_id','zero_reason',payload->>'zero_reason');
 insert into public.contract_revisions(organization_id,contract_id,version,effective_at,settings,reason) values(org,rid,c.version,case when c.version=1 then c.first_payment_date::timestamp at time zone 'Asia/Baku' else now() end,settings,payload->>'reason');
 elsif operation in('contract.pause','contract.stop','contract.resume') then
 if c.id is null then raise exception 'NOT_FOUND';end if;if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 if operation='contract.resume' and c.status='active' or operation<>'contract.resume' and c.status<>'active' then raise exception 'INVALID_CONTRACT_TRANSITION';end if;
 perform private.drain_periods(org,c.id);
 if operation<>'contract.resume' then
 if coalesce(nullif(payload->>'service_last_day','')::date,(now() at time zone 'Asia/Baku')::date)>(now() at time zone 'Asia/Baku')::date then raise exception 'FUTURE_STOP_DATE';end if;
 update public.contract_periods set service_last_day=coalesce(nullif(payload->>'service_last_day','')::date,(now() at time zone 'Asia/Baku')::date)
 where organization_id=org and contract_id=c.id and period_end>(now() at time zone 'Asia/Baku')::date;
 end if;
 nextday:=private.billing_date((now() at time zone 'Asia/Baku')::date,c.billing_day,0);
 if nextday<=(now() at time zone 'Asia/Baku')::date then nextday:=private.billing_date(nextday,c.billing_day);end if;
 update public.service_contracts set status=case operation when 'contract.resume' then 'active' when 'contract.pause' then 'paused' else 'stopped' end,
 service_last_day=case when operation='contract.resume' then null else coalesce(nullif(payload->>'service_last_day','')::date,(now() at time zone 'Asia/Baku')::date) end,
 next_period_start=case when operation='contract.resume' then nextday else next_period_start end,version=version+1 where id=rid;
 elsif operation='contract.generate' then if c.id is null then raise exception 'NOT_FOUND';end if;d:=private.generate_period(org,rid);
 else raise exception 'UNKNOWN_OPERATION';end if;
 result:=jsonb_build_object('id',rid,'deal_id',d);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data,reason) values(org,auth.uid(),operation,'admin',result,payload->>'reason');
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'subscriptions',rid);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;
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
 elsif operation='tool.reserve' then
 select * into t from public.tools where organization_id=org and id=(payload->>'tool_id')::uuid for update;
 if t.id is null or t.state<>'active' then raise exception 'TOOL_UNAVAILABLE';end if;
 if (payload->>'ends_at')::timestamptz<=(payload->>'starts_at')::timestamptz then raise exception 'INVALID_INTERVAL';end if;
 if t.kind='physical' and (nullif(payload->>'unit_number','')::int not between 1 and t.capacity or payload->>'unit_number' is null or coalesce((payload->>'quantity')::int,1)<>1) then raise exception 'PHYSICAL_UNIT_REQUIRED';end if;
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
 update public.conversations set version=version+1 where id=cid;end if;
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

create or replace function private.broadcast_outbox() returns trigger language plpgsql security definer set search_path='' as $$declare m record;begin
 for m in select distinct user_id from public.memberships where organization_id=new.organization_id and (status='active' or new.topic='membership')
 and (new.topic<>'chat' or exists(select 1 from public.conversation_members cm where cm.organization_id=new.organization_id and cm.conversation_id=new.entity_id and cm.member_id=memberships.id and cm.removed_at is null)) loop
 perform realtime.send(jsonb_build_object('event_id',new.id,'access_changed',new.topic='membership'),'invalidate','member:'||m.user_id::text,true);
 end loop;return new;end;$$;
-- RLS evaluated per source before any aggregation. No monthly template/price exposure.
create function public.monthly_portfolio(org uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with spans as (
 select c.customer_id,p.id,p.deal_id,p.period_start,
 least(p.period_end,coalesce(p.service_last_day+1,p.period_end),coalesce(c.end_date+1,p.period_end),(now() at time zone 'Asia/Baku')::date+1) end_day
 from public.contract_periods p join public.service_contracts c on c.id=p.contract_id and c.organization_id=p.organization_id
 join public.deals d on d.id=p.deal_id and d.organization_id=p.organization_id
 where p.organization_id=org and p.status='ready' and d.stage='recurring_done' and not d.archived and private.can_read_deal(org,d.id)
 ), grouped as (
 select customer_id,range_agg(daterange(period_start,end_day,'[)')) intervals,jsonb_agg(jsonb_build_object('id',id,'deal_id',deal_id,'start',period_start,'end',end_day)) periods
 from spans where end_day>period_start group by customer_id
 ) select coalesce(jsonb_agg(jsonb_build_object('id',g.customer_id,'customer_id',g.customer_id,'name',c.name,'service_days',(select sum(upper(r)-lower(r)) from unnest(g.intervals) r),'periods',g.periods)),'[]'::jsonb)
 from grouped g join public.customers c on c.organization_id=org and c.id=g.customer_id;
$$;
grant execute on function public.monthly_portfolio(uuid) to authenticated;
create function public.workspace_stats(org uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;fin jsonb;begin
 result:=jsonb_build_object('deals',(select count(*) from public.deals where organization_id=org and not archived),
 'confirmed_sales',(select count(*) from public.deals where organization_id=org and not archived and pipeline='sales' and first_confirmed_at is not null),
 'open_work',(select count(*) from public.work_items where organization_id=org and not archived and status<>'done'),
 'overdue_work',(select count(*) from public.work_items where organization_id=org and not archived and status<>'done' and due_at<now()),
 'workload',(select coalesce(jsonb_agg(x),'[]') from (select assignee_id,count(*) count from public.work_items where organization_id=org and not archived and status<>'done' group by assignee_id)x));
 if private.permitted(org,'finance.read') then
 fin:=jsonb_build_object(
 'receivable',(select coalesce(sum(amount),0) from public.financial_documents where organization_id=org and kind in('charge','adjustment','opening_receivable'))-(select coalesce(sum(a.amount),0) from public.payment_allocations a join public.financial_documents d on d.id=a.document_id and d.organization_id=a.organization_id where a.organization_id=org and d.kind in('charge','opening_receivable')),
 'payable',(select coalesce(sum(amount),0) from public.financial_documents where organization_id=org and kind in('payable','opening_payable'))-(select coalesce(sum(a.amount),0) from public.payment_allocations a join public.financial_documents d on d.id=a.document_id and d.organization_id=a.organization_id where a.organization_id=org and d.kind in('payable','opening_payable')),
 'cash_net',(select coalesce(sum(case direction when 'in' then amount else -amount end),0) from public.payments where organization_id=org),
 'cash_balance',(select coalesce(sum(opening_amount),0) from public.financial_accounts where organization_id=org)+(select coalesce(sum(case direction when 'in' then amount else -amount end),0) from public.payments where organization_id=org));
 result:=result||jsonb_build_object('finance',fin);
 end if;return result;end;$$;
grant execute on function public.workspace_stats(uuid) to authenticated;
create function public.board_page(org uuid,which_pipeline text default 'sales',search text default '',page_number int default 0) returns jsonb language sql stable security invoker set search_path='' as $$
 with filtered as materialized (select d.* from public.deal_cards d where d.organization_id=org and not d.archived and d.pipeline=which_pipeline and (search='' or d.title ilike '%'||replace(replace(left(search,120),'%',''),'_','')||'%')),
 numbered as (select f.*,row_number() over(partition by display_stage order by created_at desc,id desc) rn from filtered f)
 select jsonb_build_object('rows',(select coalesce(jsonb_agg(to_jsonb(n)-'rn'),'[]') from numbered n where rn>greatest(page_number,0)*30 and rn<=(greatest(page_number,0)+1)*30),
 'counts',(select coalesce(jsonb_object_agg(display_stage,n),'{}') from (select display_stage,count(*) n from filtered group by display_stage)c));
$$;
grant execute on function public.board_page(uuid,text,text,int) to authenticated;
-- Cover tenant/source foreign keys and common RLS paths. Other migrations keep their source history.
create index periods_source on public.contract_periods(organization_id,deal_id);
create index docs_deal_kind on public.financial_documents(organization_id,deal_id,kind);
create index allocation_doc on public.payment_allocations(organization_id,document_id);
create index if not exists allocation_payment on public.payment_allocations(organization_id,payment_id);
create index board_sort on public.deals(organization_id,pipeline,archived,created_at desc,id desc);
