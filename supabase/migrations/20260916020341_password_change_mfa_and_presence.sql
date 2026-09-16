-- Password updates are protected in the product flow by an Authenticator challenge.
-- Routine CRM access stays available after a normal password or OAuth sign-in.
create or replace function private.member_id(org uuid)
returns uuid
language sql stable security definer set search_path='' as $$
  select id
  from public.memberships
  where organization_id=org and user_id=auth.uid() and status='active';
$$;

create or replace function private.claim_bootstrap()
returns uuid
language plpgsql security definer set search_path='' as $$
declare b private.bootstrap_admins; u auth.users; org uuid;
begin
  select * into u from auth.users where id=auth.uid();
  if u.id is null or u.email_confirmed_at is null then
    raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='42501';
  end if;
  select * into b from private.bootstrap_admins where email=lower(u.email) for update;
  if b.email is null then raise exception 'BOOTSTRAP_NOT_AUTHORIZED' using errcode='42501'; end if;
  select id into org from public.organizations where slug=b.slug;
  if b.claimed_at is not null then return org; end if;
  insert into public.organizations(name,slug) values(b.organization_name,b.slug) returning id into org;
  perform private.initialize_org(org);
  insert into public.memberships(organization_id,user_id,name,status,is_admin)
  values(org,u.id,b.organization_name,'active',true);
  update private.bootstrap_admins set claimed_at=now() where email=b.email;
  return org;
end;
$$;

create or replace function private.login_context()
returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object(
    'has_active_membership',exists(select 1 from public.memberships where user_id=uid and status='active'),
    'requires_mfa',false,
    'bootstrap_pending',exists(select 1 from auth.users u join private.bootstrap_admins b on b.email=lower(u.email) where u.id=uid and u.email_confirmed_at is not null and b.claimed_at is null)
  );
end;
$$;

-- Presence is isolated to the active tenant. Clients publish only their own user id;
-- the UI resolves names from tenant membership data instead of trusting a client payload.
drop policy if exists crm_org_presence_read on realtime.messages;
drop policy if exists crm_org_presence_write on realtime.messages;
create policy crm_org_presence_read on realtime.messages
for select to authenticated
using (
  exists(
    select 1 from public.memberships m
    where m.user_id=auth.uid() and m.status='active'
      and realtime.topic()='presence:'||m.organization_id::text
  )
);
create policy crm_org_presence_write on realtime.messages
for insert to authenticated
with check (
  exists(
    select 1 from public.memberships m
    where m.user_id=auth.uid() and m.status='active'
      and realtime.topic()='presence:'||m.organization_id::text
  )
);
