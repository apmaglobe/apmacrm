-- Marketing execution lives beside a confirmed CRM order. Each plan item owns one non-billable CRM task,
-- so assignees receive it through the existing To Do workflow without affecting prices.
create table public.marketing_plans (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 deal_id uuid not null, title text not null check(length(trim(title)) between 1 and 240),
 status text not null default 'active' check(status in('active','completed','archived')),
 created_by uuid not null, version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), foreign key(organization_id,deal_id) references public.deals(organization_id,id), foreign key(organization_id,created_by) references public.memberships(organization_id,id)
);
create index marketing_plans_deal_active on public.marketing_plans(organization_id,deal_id,updated_at desc,id) where status <> 'archived';
create table public.marketing_plan_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, plan_id uuid not null, work_id uuid,
 category text not null check(category in('content_plan','shooting','post_plan','meta_manager','design','copywriting','custom')),
 title text not null check(length(trim(title)) between 1 and 240), planned_count int not null default 1 check(planned_count > 0), completed_count int not null default 0 check(completed_count >= 0),
 status text not null default 'todo' check(status in('todo','doing','done')), department_id uuid not null, assignee_id uuid not null, due_at timestamptz,
 created_by uuid not null, archived boolean not null default false, version bigint not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,work_id),
 foreign key(organization_id,plan_id) references public.marketing_plans(organization_id,id) on delete cascade,
 foreign key(organization_id,work_id) references public.work_items(organization_id,id),
 foreign key(organization_id,department_id) references public.departments(organization_id,id),
 foreign key(organization_id,assignee_id) references public.memberships(organization_id,id),
 foreign key(organization_id,created_by) references public.memberships(organization_id,id), check(completed_count <= planned_count)
);
create index marketing_items_plan_open on public.marketing_plan_items(organization_id,plan_id,due_at,id) where not archived;
create index marketing_items_assignee_open on public.marketing_plan_items(organization_id,assignee_id,status,due_at,id) where not archived;

create function private.can_read_marketing_plan(org uuid, plan uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and exists(select 1 from public.marketing_plans p where p.organization_id=org and p.id=plan and p.status<>'archived' and private.can_read_deal(org,p.deal_id));
$$;
create function private.can_manage_marketing_plan(org uuid, plan uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and exists(select 1 from public.marketing_plans p where p.organization_id=org and p.id=plan and (private.is_admin(org) or (private.permitted(org,'marketing.write') and (p.created_by=private.member_id(org) or private.can_edit_deal(org,p.deal_id)))));
$$;
grant execute on function private.can_read_marketing_plan(uuid,uuid),private.can_manage_marketing_plan(uuid,uuid) to authenticated;
alter table public.marketing_plans enable row level security;
alter table public.marketing_plan_items enable row level security;
revoke all on public.marketing_plans,public.marketing_plan_items from anon,authenticated;
grant select on public.marketing_plans,public.marketing_plan_items to authenticated;
create policy marketing_plans_read on public.marketing_plans for select to authenticated using(private.can_read_marketing_plan(organization_id,id));
create policy marketing_plan_items_read on public.marketing_plan_items for select to authenticated using(private.can_read_marketing_plan(organization_id,plan_id));

create function private.sync_marketing_item_from_work() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.marketing_item_id is not null and new.status is distinct from old.status then
   update public.marketing_plan_items set status=new.status, completed_count=case when new.status='done' then planned_count when old.status='done' then 0 else completed_count end, updated_at=now(), version=version+1 where organization_id=new.organization_id and id=new.marketing_item_id and not archived;
 end if;
 return new;
end;$$;
alter table public.work_items add column if not exists marketing_item_id uuid;
alter table public.work_items add constraint work_items_marketing_item_fk foreign key(organization_id,marketing_item_id) references public.marketing_plan_items(organization_id,id) deferrable initially deferred;
drop trigger if exists work_sync_marketing_item on public.work_items;
create trigger work_sync_marketing_item after update of status on public.work_items for each row execute function private.sync_marketing_item_from_work();

create function private.marketing_command(org uuid, operation text, payload jsonb, expected_version bigint, request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid:=private.require_member(org); rid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); plan public.marketing_plans; item public.marketing_plan_items; deal public.deals; wid uuid; result jsonb; prior private.requests; cnt int;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=marketing_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return prior.result; end if;
 if operation='plan.save' then
   select * into plan from public.marketing_plans where organization_id=org and id=rid for update;
   if plan.id is null then
     select * into deal from public.deals where organization_id=org and id=(payload->>'deal_id')::uuid for update;
     if deal.id is null or deal.first_confirmed_at is null or not private.can_edit_deal(org,deal.id) or not private.permitted(org,'marketing.write') then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
     if nullif(trim(payload->>'title'),'') is null then raise exception 'MARKETING_PLAN_TITLE_REQUIRED'; end if;
     insert into public.marketing_plans(id,organization_id,deal_id,title,created_by) values(rid,org,deal.id,payload->>'title',m);
   else
     if not private.can_manage_marketing_plan(org,rid) then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
     if plan.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
     update public.marketing_plans set title=coalesce(nullif(trim(payload->>'title'),''),title), status=coalesce(nullif(payload->>'status',''),status), version=version+1,updated_at=now() where organization_id=org and id=rid;
   end if;
 elsif operation='item.save' then
   select * into plan from public.marketing_plans where organization_id=org and id=(payload->>'plan_id')::uuid and status='active' for update;
   if plan.id is null or not private.can_manage_marketing_plan(org,plan.id) then raise exception 'MARKETING_PLAN_DENIED' using errcode='42501'; end if;
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
   update public.work_items w set archived=true,version=version+1 from public.marketing_plan_items i where i.organization_id=org and i.plan_id=rid and i.work_id=w.id and w.organization_id=org and not w.archived;
 else raise exception 'UNKNOWN_OPERATION'; end if;
 result:=jsonb_build_object('id',rid); insert into public.audit_events(organization_id,deal_id,actor_id,action,visibility,after_data) values(org,coalesce(plan.deal_id,deal.id),auth.uid(),operation,'object',result); insert into public.outbox_events(organization_id,topic,entity_id) values(org,'marketing',rid); insert into private.requests values(org,auth.uid(),request_id,operation,payload,result); return result;
end;$$;
create function public.marketing_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.marketing_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.marketing_command(uuid,text,jsonb,bigint,uuid),public.marketing_command(uuid,text,jsonb,bigint,uuid) to authenticated;
