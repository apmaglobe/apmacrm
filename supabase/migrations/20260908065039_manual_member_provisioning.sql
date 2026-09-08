-- Auth creation is a server-only saga: persist a password-free intent, create a fixed Auth UUID,
-- then atomically attach membership/departments after checking the current admin again.
create table private.member_provisioning (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 actor_id uuid not null references auth.users, request_id uuid not null, payload jsonb not null,
 auth_user_id uuid not null default gen_random_uuid(), member_id uuid,
 created_at timestamptz not null default now(), completed_at timestamptz,
 unique(organization_id,actor_id,request_id)
);
create index member_provisioning_actor on private.member_provisioning(actor_id);
create index member_provisioning_org_time on private.member_provisioning(organization_id,created_at);
alter table private.member_provisioning enable row level security;
create policy internal_only on private.member_provisioning for all to authenticated using(false) with check(false);
revoke all on private.member_provisioning from public,anon,authenticated;

create function private.prepare_member(org uuid,request_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.member_provisioning; clean jsonb; email_address text:=lower(trim(payload->>'email')); d uuid; rid uuid:=nullif(payload->>'role_id','')::uuid;
begin
 perform private.require_admin(org);
 if request_id is null or nullif(trim(payload->>'name'),'') is null or length(payload->>'name')>120 or email_address is null or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(email_address)>254 then raise exception 'INVALID_MEMBER_INPUT';end if;
 if payload-array['name','email','role_id','departments']<>'{}'::jsonb then raise exception 'INVALID_MEMBER_FIELDS';end if;
 if jsonb_typeof(coalesce(payload->'departments','[]'))<>'array' then raise exception 'INVALID_DEPARTMENTS';end if;
 if rid is not null and not exists(select 1 from public.roles where id=rid and organization_id=org) then raise exception 'INVALID_ROLE';end if;
 for d in select value::uuid from jsonb_array_elements_text(coalesce(payload->'departments','[]')) loop
  if not exists(select 1 from public.departments where id=d and organization_id=org) then raise exception 'INVALID_DEPARTMENT';end if;
 end loop;
 clean:=jsonb_build_object('name',trim(payload->>'name'),'email',email_address,'role_id',rid,'departments',coalesce(payload->'departments','[]'));
 perform pg_advisory_xact_lock(hashtextextended(org::text||auth.uid()::text||request_id::text,74));
 select * into j from private.member_provisioning p where p.organization_id=org and p.actor_id=auth.uid() and p.request_id=prepare_member.request_id for update;
 if j.id is not null then
  if j.payload<>clean then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',j.id,'auth_user_id',j.auth_user_id,'member_id',j.member_id,'completed',j.completed_at is not null);
 end if;
 -- Reopening a form after a lost response can resume this admin's unfinished intent.
 perform pg_advisory_xact_lock(hashtextextended(org::text||email_address,75));
 select * into j from private.member_provisioning p where p.organization_id=org and p.actor_id=auth.uid() and p.payload->>'email'=email_address and p.completed_at is null order by p.created_at limit 1 for update;
 if j.id is not null then
  if j.payload<>clean then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',j.id,'auth_user_id',j.auth_user_id,'member_id',null,'completed',false);
 end if;
 if exists(select 1 from auth.users where lower(email)=email_address) then raise exception 'ACCOUNT_ALREADY_EXISTS';end if;
 if (select count(*) from private.member_provisioning where organization_id=org and created_at>now()-interval '1 hour')>=30 then raise exception 'MEMBER_RATE_LIMIT';end if;
 insert into private.member_provisioning(organization_id,actor_id,request_id,payload) values(org,auth.uid(),request_id,clean) returning * into j;
 return jsonb_build_object('id',j.id,'auth_user_id',j.auth_user_id,'member_id',null,'completed',false);
end;$$;

create function private.complete_member(org uuid,job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.member_provisioning; u auth.users; mid uuid; d uuid; rid uuid;
begin
 perform private.require_admin(org);
 select * into j from private.member_provisioning where id=job and organization_id=org and actor_id=auth.uid() for update;
 if j.id is null then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if j.completed_at is not null then return jsonb_build_object('id',j.member_id,'completed',true);end if;
 select * into u from auth.users where id=j.auth_user_id;
 if u.id is null or u.email_confirmed_at is null or lower(u.email)<>j.payload->>'email' or u.raw_app_meta_data->>'apma_provisioning_id' is distinct from j.id::text then raise exception 'AUTH_PROVISIONING_INCOMPLETE';end if;
 rid:=nullif(j.payload->>'role_id','')::uuid;
 if rid is not null and not exists(select 1 from public.roles where id=rid and organization_id=org) then raise exception 'INVALID_ROLE';end if;
 for d in select value::uuid from jsonb_array_elements_text(j.payload->'departments') loop
  if not exists(select 1 from public.departments where id=d and organization_id=org) then raise exception 'INVALID_DEPARTMENT';end if;
 end loop;
 insert into public.memberships(organization_id,user_id,name,status,is_admin,role_id)
 values(org,u.id,j.payload->>'name','active',false,rid) returning id into mid;
 insert into public.department_members(organization_id,department_id,member_id)
 select org,value::uuid,mid from jsonb_array_elements_text(j.payload->'departments') on conflict do nothing;
 update private.member_provisioning set member_id=mid,completed_at=now() where id=j.id;
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data)
 values(org,auth.uid(),'member.manual_create','admin',jsonb_build_object('member_id',mid,'name',j.payload->>'name','role_id',rid,'departments',j.payload->'departments','source','admin_manual'));
 return jsonb_build_object('id',mid,'completed',true);
end;$$;
create function public.prepare_member(org uuid,request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_member(org,request_id,payload);$$;
create function public.complete_member(org uuid,job uuid) returns jsonb language sql security invoker set search_path='' as $$select private.complete_member(org,job);$$;
revoke all on function private.prepare_member(uuid,uuid,jsonb),private.complete_member(uuid,uuid),public.prepare_member(uuid,uuid,jsonb),public.complete_member(uuid,uuid) from public,anon,authenticated;
grant execute on function private.prepare_member(uuid,uuid,jsonb),private.complete_member(uuid,uuid),public.prepare_member(uuid,uuid,jsonb),public.complete_member(uuid,uuid) to authenticated;
