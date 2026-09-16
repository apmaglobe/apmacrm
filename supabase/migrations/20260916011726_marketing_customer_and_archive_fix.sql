-- A plan can be prepared against a customer before its CRM order exists.
alter table public.marketing_plans add column if not exists customer_id uuid;
alter table public.marketing_plans add constraint marketing_plans_customer_fk foreign key(organization_id,customer_id) references public.customers(organization_id,id);
create index if not exists marketing_plans_customer_active on public.marketing_plans(organization_id,customer_id,updated_at desc,id) where status<>'archived';
create or replace function private.marketing_command(org uuid, operation text, payload jsonb, expected_version bigint, request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid:=private.require_member(org); rid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); plan public.marketing_plans; item public.marketing_plan_items; deal public.deals; wid uuid; result jsonb; prior private.requests; cnt int;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=marketing_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return prior.result; end if;
 if operation='plan.save' then
   select * into plan from public.marketing_plans where organization_id=org and id=rid for update;
   if plan.id is null then
     if not private.is_admin(org) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
     if nullif(trim(payload->>'title'),'') is null then raise exception 'MARKETING_PLAN_TITLE_REQUIRED'; end if;
     if nullif(payload->>'deal_id','') is not null then
       select * into deal from public.deals where organization_id=org and id=(payload->>'deal_id')::uuid for update;
       if deal.id is null or deal.first_confirmed_at is null then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
     end if;
     insert into public.marketing_plans(id,organization_id,deal_id,customer_id,title,created_by) values(rid,org,nullif(payload->>'deal_id','')::uuid,nullif(payload->>'customer_id','')::uuid,payload->>'title',m);
   else
     if not private.can_manage_marketing_plan(org,rid) then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
     if plan.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
     if plan.deal_id is null and nullif(payload->>'deal_id','') is not null then
       if not private.is_admin(org) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
       select * into deal from public.deals where organization_id=org and id=(payload->>'deal_id')::uuid for update;
       if deal.id is null or deal.first_confirmed_at is null then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
       update public.marketing_plans set deal_id=deal.id,customer_id=coalesce(nullif(payload->>'customer_id','')::uuid,customer_id),title=coalesce(nullif(trim(payload->>'title'),''),title),version=version+1,updated_at=now() where organization_id=org and id=rid;
     else
       update public.marketing_plans set customer_id=coalesce(nullif(payload->>'customer_id','')::uuid,customer_id), title=coalesce(nullif(trim(payload->>'title'),''),title), status=coalesce(nullif(payload->>'status',''),status), version=version+1,updated_at=now() where organization_id=org and id=rid;
     end if;
   end if;
 elsif operation='item.save' then
   select * into plan from public.marketing_plans where organization_id=org and id=(payload->>'plan_id')::uuid and status='active' for update;
   if plan.id is null or plan.deal_id is null or not private.can_manage_marketing_plan(org,plan.id) then raise exception 'MARKETING_PLAN_ATTACH_REQUIRED' using errcode='42501'; end if;
   if nullif(trim(payload->>'title'),'') is null then raise exception 'MARKETING_ITEM_TITLE_REQUIRED'; end if;
   if not exists(select 1 from public.departments where organization_id=org and id=(payload->>'department_id')::uuid and not archived) then raise exception 'INVALID_DEPARTMENT'; end if;
   if not exists(select 1 from public.memberships where organization_id=org and id=(payload->>'assignee_id')::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE'; end if;
   select * into item from public.marketing_plan_items where organization_id=org and id=rid for update;
   if item.id is not null and item.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
   if item.id is null then
     wid:=gen_random_uuid();
     insert into public.marketing_plan_items(id,organization_id,plan_id,category,title,planned_count,completed_count,status,department_id,assignee_id,due_at,created_by) values(rid,org,plan.id,coalesce(payload->>'category','custom'),payload->>'title',greatest(1,coalesce((payload->>'planned_count')::int,1)),0,'todo',(payload->>'department_id')::uuid,(payload->>'assignee_id')::uuid,nullif(payload->>'due_at','')::timestamptz,m);
     insert into public.work_items(id,organization_id,deal_id,marketing_item_id,kind,name,description,department_id,assignee_id,status,quantity,due_at) values(wid,org,plan.deal_id,rid,'task',payload->>'title','Marketing plan: '||coalesce(payload->>'category','custom'),(payload->>'department_id')::uuid,(payload->>'assignee_id')::uuid,'todo',1,nullif(payload->>'due_at','')::timestamptz);
     update public.marketing_plan_items set work_id=wid where organization_id=org and id=rid;
   else
     if not private.can_manage_marketing_plan(org,plan.id) then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
     update public.marketing_plan_items set category=coalesce(payload->>'category',category),title=payload->>'title',planned_count=greatest(1,coalesce((payload->>'planned_count')::int,planned_count)),department_id=(payload->>'department_id')::uuid,assignee_id=(payload->>'assignee_id')::uuid,due_at=nullif(payload->>'due_at','')::timestamptz,version=version+1,updated_at=now() where organization_id=org and id=rid;
     update public.work_items set name=payload->>'title',department_id=(payload->>'department_id')::uuid,assignee_id=(payload->>'assignee_id')::uuid,due_at=nullif(payload->>'due_at','')::timestamptz,version=version+1 where organization_id=org and id=item.work_id;
   end if;
   insert into public.notifications(organization_id,recipient_id,deal_id,event_key,label) values(org,(payload->>'assignee_id')::uuid,plan.deal_id,'marketing-assigned:'||rid::text||':'||(payload->>'assignee_id'),'Marketing plan işi təyin edildi: '||left(payload->>'title',180)) on conflict do nothing;
 elsif operation='item.progress' then
   select i.* into item from public.marketing_plan_items i where i.organization_id=org and i.id=rid and not i.archived for update;
   if item.id is null or not(private.can_manage_marketing_plan(org,item.plan_id) or item.assignee_id=m) then raise exception 'MARKETING_ITEM_DENIED' using errcode='42501'; end if;
   if item.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
   cnt:=least(item.planned_count,greatest(0,coalesce((payload->>'completed_count')::int,item.completed_count)));
   update public.marketing_plan_items set completed_count=cnt,status=case when cnt=item.planned_count then 'done' when cnt>0 then 'doing' else 'todo' end,version=version+1,updated_at=now() where organization_id=org and id=rid;
   update public.work_items set status=case when cnt=item.planned_count then 'done' when cnt>0 then 'doing' else 'todo' end,version=version+1 where organization_id=org and id=item.work_id;
 elsif operation='item.archive' then
   select i.* into item from public.marketing_plan_items i where i.organization_id=org and i.id=rid for update;
   if item.id is null or not private.can_manage_marketing_plan(org,item.plan_id) then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
   if item.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
   update public.marketing_plan_items set archived=true,version=version+1,updated_at=now() where organization_id=org and id=rid;
   update public.work_items set archived=true,version=version+1 where organization_id=org and id=item.work_id;
 elsif operation='plan.archive' then
   select * into plan from public.marketing_plans where organization_id=org and id=rid for update;
   if plan.id is null or not private.can_manage_marketing_plan(org,rid) then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
   if plan.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
   update public.marketing_plans set status='archived',version=version+1,updated_at=now() where organization_id=org and id=rid;
   update public.marketing_plan_items set archived=true,version=version+1,updated_at=now() where organization_id=org and plan_id=rid and not archived;
   update public.work_items w set archived=true,version=w.version+1 from public.marketing_plan_items i where i.organization_id=org and i.plan_id=rid and i.work_id=w.id and w.organization_id=org and not w.archived;
 else raise exception 'UNKNOWN_OPERATION'; end if;
 result:=jsonb_build_object('id',rid); insert into public.audit_events(organization_id,deal_id,actor_id,action,visibility,after_data) values(org,coalesce(plan.deal_id,(select p.deal_id from public.marketing_plans p where p.organization_id=org and p.id=rid)),auth.uid(),operation,'object',result); insert into public.outbox_events(organization_id,topic,entity_id) values(org,'marketing',rid); insert into private.requests values(org,auth.uid(),request_id,operation,payload,result); return result;
end;$$;
create or replace function public.marketing_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.marketing_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.marketing_command(uuid,text,jsonb,bigint,uuid),public.marketing_command(uuid,text,jsonb,bigint,uuid) to authenticated;
