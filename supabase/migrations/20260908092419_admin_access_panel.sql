-- Tenant-scoped link administration. Tokens are private and never included in audit/outbox.
create table private.join_links (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 name text not null, token uuid not null unique default gen_random_uuid(),
 created_by uuid references auth.users, created_at timestamptz not null default now(),
 expires_at timestamptz, revoked_at timestamptz, version bigint not null default 1,
 unique(organization_id,id)
);
create index join_links_org_created on private.join_links(organization_id,created_at desc,id);
insert into private.join_links(organization_id,name,token,created_at)
 select id,'İlkin qoşulma linki',join_token,created_at from public.organizations;
create function private.initialize_join_link() returns trigger language plpgsql set search_path='' as $$
begin
 insert into private.join_links(organization_id,name,token,created_at) values(new.id,'İlkin qoşulma linki',new.join_token,new.created_at);
 return new;
end;$$;
revoke all on function private.initialize_join_link() from public,anon,authenticated;
create trigger organization_join_link after insert on public.organizations for each row execute function private.initialize_join_link();
-- Ordinary members can read organization metadata, never the legacy join credential.
revoke select on public.organizations from authenticated;
grant select(id,name,slug,timezone,logo_path,version,created_at) on public.organizations to authenticated;
alter table public.invitations add column revoked_at timestamptz,
 add column accepted_at timestamptz, add column created_by uuid references auth.users,
 add column version bigint not null default 1;
create index invitations_org_created on public.invitations(organization_id,created_at desc,id);
create table private.invitation_tokens (
 invitation_id uuid primary key references public.invitations on delete cascade, token text not null
);
create table private.join_requests (
 member_id uuid primary key, organization_id uuid not null,
 source_kind text not null check(source_kind in('join','email','legacy')),
 source_id uuid, requested_at timestamptz not null default now(),
 decision text not null default 'pending' check(decision in('pending','approved','rejected')),
 decided_at timestamptz, decided_by uuid references auth.users, reason text,
 foreign key(organization_id,member_id) references public.memberships(organization_id,id)
);
create index join_requests_org_time on private.join_requests(organization_id,requested_at desc,member_id);
create index join_requests_source on private.join_requests(source_kind,source_id);
insert into private.join_requests(member_id,organization_id,source_kind,requested_at)
 select id,organization_id,'legacy',joined_at from public.memberships where status='pending';
alter table private.join_links enable row level security;
alter table private.invitation_tokens enable row level security;
alter table private.join_requests enable row level security;
revoke all on private.join_links,private.invitation_tokens,private.join_requests from public,anon,authenticated;

create function private.admin_access_read(org uuid,page_offset integer default 0) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 perform private.require_admin(org);
 if page_offset<0 or page_offset>100000 then raise exception 'INVALID_PAGE';end if;
 select jsonb_build_object(
 'counts',jsonb_build_object(
  'pending',(select count(*) from public.memberships where organization_id=org and status='pending'),
  'active_links',(select count(*) from private.join_links where organization_id=org and revoked_at is null and (expires_at is null or expires_at>now()))+(select count(*) from public.invitations where organization_id=org and revoked_at is null and accepted_by is null and expires_at>now()),
  'members',(select count(*) from public.memberships where organization_id=org and status='active')),
 'links',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc,l.id) from (
  select * from (
   select j.id,'join'::text kind,j.name,null::text email,j.token::text token,j.created_at,j.expires_at,j.revoked_at,null::timestamptz accepted_at,j.version,
    case when j.revoked_at is not null then 'revoked' when j.expires_at<=now() then 'expired' else 'active' end status,
    (select count(*) from private.join_requests r where r.source_kind='join' and r.source_id=j.id) uses
   from private.join_links j where j.organization_id=org
   union all
   select i.id,'email',i.email,i.email,t.token,i.created_at,i.expires_at,i.revoked_at,i.accepted_at,i.version,
    case when i.accepted_by is not null then 'accepted' when i.revoked_at is not null then 'revoked' when i.expires_at<=now() then 'expired' else 'active' end,
    case when i.accepted_by is null then 0 else 1 end
   from public.invitations i left join private.invitation_tokens t on t.invitation_id=i.id where i.organization_id=org
  ) combined order by created_at desc,id offset page_offset limit 101
 ) l),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(r) order by r.requested_at desc,r.id) from (
  select m.id,m.name,u.email,m.version,m.status,
   case when m.status='pending' then 'pending' when j.decision in('approved','rejected') then j.decision when m.status='active' then 'approved' else 'rejected' end decision,
   coalesce(j.requested_at,m.joined_at) requested_at,j.decided_at,j.reason,coalesce(j.source_kind,'legacy') source_kind,
   coalesce(l.name,i.email,'Əvvəlki müraciət') source_name
  from public.memberships m join auth.users u on u.id=m.user_id
  left join private.join_requests j on j.member_id=m.id
  left join private.join_links l on j.source_kind='join' and l.id=j.source_id
  left join public.invitations i on j.source_kind='email' and i.id=j.source_id
  where m.organization_id=org and (m.status='pending' or j.member_id is not null)
  order by coalesce(j.requested_at,m.joined_at) desc,m.id offset page_offset limit 101
 ) r),'[]')) into result;
 return result;
end;$$;
create function public.admin_access_read(org uuid,page_offset integer default 0) returns jsonb
 language sql security invoker set search_path='' as $$select private.admin_access_read(org,page_offset);$$;

create function private.admin_access_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.requests; rid uuid; current_v bigint; kind text; ttl integer;
 token_value text; result jsonb; mid uuid; m public.memberships; begin
 perform private.require_admin(org);
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if request_id is null or payload is null or jsonb_typeof(payload)<>'object' then raise exception 'INVALID_INPUT';end if;
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=admin_access_command.request_id;
 if found then
  if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 kind:=payload->>'kind';rid:=nullif(payload->>'id','')::uuid;
 if operation in('link.create','link.renew','link.revoke') then
  if kind not in('join','email') or kind is null then raise exception 'INVALID_LINK_KIND';end if;
  ttl:=coalesce((payload->>'days')::integer,7);
  if ttl not in(1,7,30) then raise exception 'INVALID_EXPIRY';end if;
  if operation='link.create' then
   if (select count(*) from (select id from private.join_links where organization_id=org and created_by=auth.uid() and created_at>now()-interval '1 hour' union all select id from public.invitations where organization_id=org and created_by=auth.uid() and created_at>now()-interval '1 hour') recent)>=100 then raise exception 'LINK_RATE_LIMIT';end if;
   rid:=gen_random_uuid();
   if kind='join' then
    if length(trim(coalesce(payload->>'name','')))<1 or length(payload->>'name')>120 then raise exception 'INVALID_NAME';end if;
    insert into private.join_links(id,organization_id,name,created_by,expires_at) values(rid,org,trim(payload->>'name'),auth.uid(),now()+ttl*interval '1 day');
   else
    if coalesce(payload->>'email','')!~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or length(payload->>'email')>254 then raise exception 'INVALID_EMAIL';end if;
    token_value:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    insert into public.invitations(id,organization_id,email,token_hash,expires_at,created_by) values(rid,org,lower(trim(payload->>'email')),encode(sha256(convert_to(token_value,'UTF8')),'hex'),now()+ttl*interval '1 day',auth.uid());
    insert into private.invitation_tokens values(rid,token_value);
   end if;
  else
   if kind='join' then select version into current_v from private.join_links where organization_id=org and id=rid for update;
   else select version into current_v from public.invitations where organization_id=org and id=rid for update;end if;
   if current_v is null then raise exception 'NOT_FOUND';end if;
   if current_v is distinct from expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
   if kind='email' and exists(select 1 from public.invitations where id=rid and accepted_by is not null) then raise exception 'INVITATION_USED';end if;
   if operation='link.revoke' then
    if kind='join' then update private.join_links set revoked_at=now(),version=version+1 where id=rid;
    else update public.invitations set revoked_at=now(),version=version+1 where id=rid;end if;
   else
    if kind='join' then update private.join_links set token=gen_random_uuid(),expires_at=now()+ttl*interval '1 day',revoked_at=null,version=version+1 where id=rid;
    else
     token_value:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
     update public.invitations set token_hash=encode(sha256(convert_to(token_value,'UTF8')),'hex'),expires_at=now()+ttl*interval '1 day',revoked_at=null,version=version+1 where id=rid;
     insert into private.invitation_tokens values(rid,token_value) on conflict(invitation_id) do update set token=excluded.token;
    end if;
   end if;
  end if;
 elsif operation in('request.approve','request.reject') then
  select * into m from public.memberships where organization_id=org and id=rid for update;
  if m.id is null then raise exception 'NOT_FOUND';end if;
  if m.version is distinct from expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
  if m.status<>'pending' then raise exception 'REQUEST_ALREADY_DECIDED';end if;
  if operation='request.reject' and length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'REASON_REQUIRED';end if;
  result:=private.identity_command(org,'member.update',jsonb_build_object('id',rid,'status',case when operation='request.approve' then 'active' else 'suspended' end,'reason',left(payload->>'reason',500)),expected_version,gen_random_uuid());
  insert into private.join_requests(member_id,organization_id,source_kind,requested_at,decision,decided_at,decided_by,reason)
   values(rid,org,'legacy',m.joined_at,case when operation='request.approve' then 'approved' else 'rejected' end,now(),auth.uid(),left(payload->>'reason',500))
   on conflict(member_id) do update set decision=excluded.decision,decided_at=excluded.decided_at,decided_by=excluded.decided_by,reason=excluded.reason;
 else raise exception 'UNKNOWN_OPERATION';end if;
 result:=jsonb_build_object('id',rid);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data,reason) values(org,auth.uid(),operation,'admin',jsonb_build_object('id',rid,'kind',kind),left(payload->>'reason',500));
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'membership',rid);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 return result;
end;$$;
create function public.admin_access_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
 returns jsonb language sql security invoker set search_path='' as $$select private.admin_access_command(org,operation,payload,expected_version,request_id);$$;

create or replace function private.join_organization(join_token uuid,display_name text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare l private.join_links; mid uuid; existing public.memberships; begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='42501';end if;
 select * into l from private.join_links where token=join_token;
 if l.id is null then raise exception 'INVALID_JOIN_LINK';end if;
 perform pg_advisory_xact_lock(hashtextextended(l.organization_id::text,0));
 select * into l from private.join_links where id=l.id for update;
 if l.token<>join_token or l.revoked_at is not null or l.expires_at<=now() then raise exception 'INVALID_JOIN_LINK';end if;
 select * into existing from public.memberships where organization_id=l.organization_id and user_id=auth.uid();
 if existing.id is not null then return existing.id;end if;
 insert into public.memberships(organization_id,user_id,name,status,role_id) values(l.organization_id,auth.uid(),left(coalesce(nullif(trim(display_name),''),'Əməkdaş'),120),'pending',(select id from public.roles where organization_id=l.organization_id and name='Əməkdaş')) returning id into mid;
 insert into private.join_requests(member_id,organization_id,source_kind,source_id) values(mid,l.organization_id,'join',l.id);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(l.organization_id,auth.uid(),'membership.requested','admin',jsonb_build_object('id',mid,'source_id',l.id));
 insert into public.outbox_events(organization_id,topic,entity_id) values(l.organization_id,'membership',mid);
 return mid;
end;$$;
create or replace function private.invite_accept(token text,display_name text) returns uuid
 language plpgsql security definer set search_path='' as $$
declare i public.invitations; u auth.users; mid uuid; begin
 select * into u from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if u.id is null then raise exception 'VERIFIED_EMAIL_REQUIRED';end if;
 select * into i from public.invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex');
 if i.id is null then raise exception 'INVALID_INVITATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(i.organization_id::text,0));
 select * into i from public.invitations where id=i.id for update;
 if i.token_hash<>encode(sha256(convert_to(token,'UTF8')),'hex') or lower(u.email)<>i.email or i.revoked_at is not null or i.expires_at<=now() or (i.accepted_by is not null and i.accepted_by<>u.id) then raise exception 'INVALID_INVITATION';end if;
 select id into mid from public.memberships where organization_id=i.organization_id and user_id=u.id;
 if mid is null then
  insert into public.memberships(organization_id,user_id,name,status,role_id) values(i.organization_id,u.id,left(coalesce(nullif(trim(display_name),''),'Əməkdaş'),120),'pending',(select id from public.roles where organization_id=i.organization_id and name='Əməkdaş')) returning id into mid;
  insert into private.join_requests(member_id,organization_id,source_kind,source_id) values(mid,i.organization_id,'email',i.id);
 end if;
 if i.accepted_by is null then
  update public.invitations set accepted_by=u.id,accepted_at=now(),version=version+1 where id=i.id;
  insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(i.organization_id,auth.uid(),'invitation.accepted','admin',jsonb_build_object('id',i.id,'member_id',mid));
  insert into public.outbox_events(organization_id,topic,entity_id) values(i.organization_id,'membership',mid);
 end if;
 return mid;
end;$$;
-- Retain the old UI/RPC while making newly created email links manageable.
create or replace function private.invite_create(org uuid,email_address text) returns text
 language plpgsql security definer set search_path='' as $$
declare r jsonb; token_value text; begin
 r:=private.admin_access_command(org,'link.create',jsonb_build_object('kind','email','email',email_address,'days',7),1,gen_random_uuid());
 select token into token_value from private.invitation_tokens where invitation_id=(r->>'id')::uuid;
 return token_value;
end;$$;
revoke all on function private.admin_access_read(uuid,integer),public.admin_access_read(uuid,integer),private.admin_access_command(uuid,text,jsonb,bigint,uuid),public.admin_access_command(uuid,text,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function private.admin_access_read(uuid,integer),public.admin_access_read(uuid,integer),private.admin_access_command(uuid,text,jsonb,bigint,uuid),public.admin_access_command(uuid,text,jsonb,bigint,uuid) to authenticated;

-- Preserve the original approval decision when an active employee is later offboarded.
create function private.record_join_decision() returns trigger language plpgsql set search_path='' as $$
begin
 update private.join_requests set decision=case when new.status='active' then 'approved' else 'rejected' end,decided_at=now(),decided_by=auth.uid()
 where member_id=new.id and decision='pending';
 return new;
end;$$;
revoke all on function private.record_join_decision() from public,anon,authenticated;
create trigger member_join_decision after update of status on public.memberships for each row when(old.status='pending' and new.status<>'pending') execute function private.record_join_decision();
