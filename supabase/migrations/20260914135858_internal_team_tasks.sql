-- Internal team tasks are deliberately separate from CRM work_items and their deal lifecycle.
create table public.internal_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations,
  title text not null check(length(trim(title)) between 1 and 240),
  description text check(description is null or length(description) <= 10000),
  status text not null default 'todo' check(status in('todo','doing','done')),
  due_at timestamptz,
  created_by uuid not null,
  archived boolean not null default false,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,created_by) references public.memberships(organization_id,id)
);
create index internal_tasks_open on public.internal_tasks(organization_id,status,due_at,id) where not archived;
create index internal_tasks_creator on public.internal_tasks(organization_id,created_by) where not archived;

create table public.internal_task_assignments (
  organization_id uuid not null,
  task_id uuid not null,
  member_id uuid not null,
  assigned_at timestamptz not null default now(),
  primary key(organization_id,task_id,member_id),
  foreign key(organization_id,task_id) references public.internal_tasks(organization_id,id) on delete cascade,
  foreign key(organization_id,member_id) references public.memberships(organization_id,id)
);
create index internal_task_assignments_member on public.internal_task_assignments(organization_id,member_id,task_id);

create table public.internal_task_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid not null,
  author_id uuid not null,
  body text not null check(length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,task_id) references public.internal_tasks(organization_id,id) on delete cascade,
  foreign key(organization_id,author_id) references public.memberships(organization_id,id)
);
create index internal_task_updates_feed on public.internal_task_updates(organization_id,task_id,created_at desc,id);

create function private.can_read_internal_task(org uuid, task uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member_id(org) is not null and exists(
    select 1 from public.internal_tasks t
    where t.organization_id=org and t.id=task and not t.archived
      and (private.is_admin(org) or t.created_by=private.member_id(org)
        or exists(select 1 from public.internal_task_assignments a where a.organization_id=org and a.task_id=t.id and a.member_id=private.member_id(org)))
  );
$$;
create function private.can_manage_internal_task(org uuid, task uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.member_id(org) is not null and exists(
    select 1 from public.internal_tasks t where t.organization_id=org and t.id=task
      and (private.is_admin(org) or t.created_by=private.member_id(org))
  );
$$;
grant execute on function private.can_read_internal_task(uuid,uuid),private.can_manage_internal_task(uuid,uuid) to authenticated;

alter table public.internal_tasks enable row level security;
alter table public.internal_task_assignments enable row level security;
alter table public.internal_task_updates enable row level security;
revoke all on public.internal_tasks,public.internal_task_assignments,public.internal_task_updates from anon,authenticated;
grant select on public.internal_tasks,public.internal_task_assignments,public.internal_task_updates to authenticated;
create policy internal_tasks_read on public.internal_tasks for select to authenticated using(private.can_read_internal_task(organization_id,id));
create policy internal_task_assignments_read on public.internal_task_assignments for select to authenticated using(private.can_read_internal_task(organization_id,task_id));
create policy internal_task_updates_read on public.internal_task_updates for select to authenticated using(private.can_read_internal_task(organization_id,task_id));

create function private.tasks_command(org uuid, operation text, payload jsonb, expected_version bigint, request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  m uuid;
  rid uuid;
  prior private.requests;
  task public.internal_tasks;
  result jsonb;
  assignee text;
  update_id uuid;
begin
  m:=private.require_member(org);
  perform pg_advisory_xact_lock(hashtextextended(org::text,0));
  select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=tasks_command.request_id;
  if found then
    if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());

  if operation='task.save' then
    select * into task from public.internal_tasks where organization_id=org and id=rid for update;
    if task.id is null then
      if not private.permitted(org,'tasks.write') then raise exception 'TASK_WRITE_REQUIRED' using errcode='42501'; end if;
      if nullif(trim(payload->>'title'),'') is null then raise exception 'TASK_TITLE_REQUIRED'; end if;
      if jsonb_array_length(coalesce(payload->'assignees','[]'))=0 then raise exception 'TASK_ASSIGNEE_REQUIRED'; end if;
      insert into public.internal_tasks(id,organization_id,title,description,due_at,created_by)
      values(rid,org,payload->>'title',nullif(payload->>'description',''),nullif(payload->>'due_at','')::timestamptz,m);
    else
      if not private.can_manage_internal_task(org,rid) then raise exception 'TASK_MANAGER_REQUIRED' using errcode='42501'; end if;
      if task.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
      if nullif(trim(payload->>'title'),'') is null then raise exception 'TASK_TITLE_REQUIRED'; end if;
      if jsonb_array_length(coalesce(payload->'assignees','[]'))=0 then raise exception 'TASK_ASSIGNEE_REQUIRED'; end if;
      update public.internal_tasks set title=payload->>'title',description=nullif(payload->>'description',''),due_at=nullif(payload->>'due_at','')::timestamptz,version=version+1,updated_at=now() where organization_id=org and id=rid;
      delete from public.internal_task_assignments where organization_id=org and task_id=rid;
    end if;
    for assignee in select jsonb_array_elements_text(coalesce(payload->'assignees','[]')) loop
      if not exists(select 1 from public.memberships where organization_id=org and id=assignee::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE'; end if;
      insert into public.internal_task_assignments(organization_id,task_id,member_id) values(org,rid,assignee::uuid) on conflict do nothing;
      insert into public.notifications(organization_id,recipient_id,event_key,label)
      values(org,assignee::uuid,'internal-task-assigned:'||rid::text||':'||assignee,'Sizə daxili task təyin edildi: '||left(payload->>'title',180)) on conflict do nothing;
    end loop;
  elsif operation='task.status' then
    select * into task from public.internal_tasks where organization_id=org and id=rid and not archived for update;
    if task.id is null or not (private.can_manage_internal_task(org,rid) or exists(select 1 from public.internal_task_assignments where organization_id=org and task_id=rid and member_id=m)) then raise exception 'TASK_ACCESS_DENIED' using errcode='42501'; end if;
    if task.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
    if payload->>'status' not in('todo','doing','done') then raise exception 'INVALID_TASK_STATUS'; end if;
    update public.internal_tasks set status=payload->>'status',version=version+1,updated_at=now() where organization_id=org and id=rid;
  elsif operation='task.update.add' then
    select * into task from public.internal_tasks where organization_id=org and id=rid and not archived for update;
    if task.id is null or not private.can_read_internal_task(org,rid) then raise exception 'TASK_ACCESS_DENIED' using errcode='42501'; end if;
    if nullif(trim(payload->>'body'),'') is null then raise exception 'TASK_UPDATE_REQUIRED'; end if;
    update_id:=gen_random_uuid();
    insert into public.internal_task_updates(id,organization_id,task_id,author_id,body) values(update_id,org,rid,m,payload->>'body');
    update public.internal_tasks set updated_at=now() where organization_id=org and id=rid;
  elsif operation='task.archive' then
    select * into task from public.internal_tasks where organization_id=org and id=rid for update;
    if task.id is null or not private.can_manage_internal_task(org,rid) then raise exception 'TASK_MANAGER_REQUIRED' using errcode='42501'; end if;
    if task.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
    update public.internal_tasks set archived=true,version=version+1,updated_at=now() where organization_id=org and id=rid;
  else
    raise exception 'UNKNOWN_OPERATION';
  end if;
  result:=jsonb_build_object('id',rid,'version',coalesce((select version from public.internal_tasks where organization_id=org and id=rid),0));
  insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(org,auth.uid(),operation,'admin',result);
  insert into public.outbox_events(organization_id,topic,entity_id) values(org,'internal_tasks',rid);
  insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
  return result;
end;
$$;
create function public.tasks_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.tasks_command(org,operation,payload,expected_version,request_id); $$;
grant execute on function private.tasks_command(uuid,text,jsonb,bigint,uuid),public.tasks_command(uuid,text,jsonb,bigint,uuid) to authenticated;
