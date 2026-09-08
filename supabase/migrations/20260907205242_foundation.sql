-- Tenant boundary. Application writes use narrowly checked transaction functions.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 timezone text not null default 'Asia/Baku' check(timezone='Asia/Baku'),
 logo_path text, join_token uuid not null default gen_random_uuid(), version bigint not null default 1,
 created_at timestamptz not null default now()
);
create table public.roles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 name text not null, permissions text[] not null default '{commercials.read}', archived boolean not null default false,
 version bigint not null default 1, unique(organization_id,id), unique(organization_id,name)
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 user_id uuid not null references auth.users, role_id uuid, name text not null,
 is_admin boolean not null default false, status text not null default 'pending' check(status in('active','pending','suspended')),
 overrides jsonb not null default '{}', skills text[] not null default '{}', version bigint not null default 1,
 joined_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,user_id),
 foreign key(organization_id,role_id) references public.roles(organization_id,id)
);
create index memberships_user_active on public.memberships(user_id,organization_id) where status='active';
create table public.departments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 name text not null, archived boolean not null default false, version bigint not null default 1,
 unique(organization_id,id), unique(organization_id,name)
);
create table public.department_members (
 organization_id uuid not null, department_id uuid not null, member_id uuid not null,
 primary key(organization_id,department_id,member_id),
 foreign key(organization_id,department_id) references public.departments(organization_id,id),
 foreign key(organization_id,member_id) references public.memberships(organization_id,id)
);
create index department_members_member on public.department_members(organization_id,member_id,department_id);
create table public.invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 email text not null, token_hash text not null unique, expires_at timestamptz not null,
 accepted_by uuid references auth.users, created_at timestamptz not null default now(), unique(organization_id,id)
);
create table private.bootstrap_admins(email text primary key, organization_name text not null, slug text not null unique, claimed_at timestamptz);
create table private.requests (
 organization_id uuid not null references public.organizations, actor_id uuid not null references auth.users,
 request_id uuid not null, operation text not null, payload jsonb not null, result jsonb not null,
 primary key(organization_id,actor_id,request_id)
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 external_id text not null, name text not null check(length(trim(name))>0), category text, note text,
 archived boolean not null default false, version bigint not null default 1,
 created_at timestamptz not null default now(), unique(organization_id,id), unique(organization_id,external_id)
);
create table public.customer_locations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, customer_id uuid not null,
 external_id text not null, name text, address text, latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180), manual_pin boolean not null default false,
 version bigint not null default 1, unique(organization_id,id), unique(organization_id,customer_id,external_id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 check((latitude is null)=(longitude is null))
);
create table public.contacts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, customer_id uuid not null,
 external_id text not null, name text, phone text, email text, version bigint not null default 1,
 unique(organization_id,id), unique(organization_id,customer_id,external_id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id)
);
create table public.service_catalog (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, department_id uuid not null,
 name text not null, description text, task_templates jsonb not null default '[]',
 archived boolean not null default false, version bigint not null default 1, unique(organization_id,id),
 foreign key(organization_id,department_id) references public.departments(organization_id,id)
);
create table public.catalog_prices (
 organization_id uuid not null, service_id uuid not null, amount bigint check(amount>=0),
 primary key(organization_id,service_id), foreign key(organization_id,service_id) references public.service_catalog(organization_id,id)
);
create table public.loss_reasons (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 name text not null, archived boolean not null default false, version bigint not null default 1, unique(organization_id,id)
);
create table public.pipeline_stages (
 organization_id uuid not null references public.organizations, code text not null, pipeline text not null,
 label text not null, color text not null default '#6366f1', position int not null,
 primary key(organization_id,code), check(pipeline in('sales','recurring'))
);
create table private.serials (organization_id uuid not null references public.organizations, year int not null, value bigint not null, primary key(organization_id,year));
create table public.deals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 serial text not null, title text, customer_id uuid, location_id uuid, created_by uuid, accountable_id uuid,
 creation_source text not null check(creation_source in('manual','webhook','recurring')),
 pipeline text not null default 'sales' check(pipeline in('sales','recurring')), stage text not null default 'to_call',
 intake_department_id uuid, intake jsonb, due_at timestamptz, first_confirmed_at timestamptz, delivered_at timestamptz,
 loss_reason_id uuid, completion_reason text, open_work_snapshot uuid[] not null default '{}',
 zero_reason text, archived boolean not null default false, rank bigint not null default 0,
 version bigint not null default 1, created_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,serial),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,location_id) references public.customer_locations(organization_id,id),
 foreign key(organization_id,created_by) references public.memberships(organization_id,id),
 foreign key(organization_id,accountable_id) references public.memberships(organization_id,id),
 foreign key(organization_id,intake_department_id) references public.departments(organization_id,id),
 foreign key(organization_id,loss_reason_id) references public.loss_reasons(organization_id,id),
 foreign key(organization_id,stage) references public.pipeline_stages(organization_id,code),
 check((creation_source='manual')=(created_by is not null))
);
create index deals_board on public.deals(organization_id,pipeline,stage,rank,id) where not archived;
create table public.deal_members (
 organization_id uuid not null, deal_id uuid not null, member_id uuid not null,
 primary key(organization_id,deal_id,member_id),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id),
 foreign key(organization_id,member_id) references public.memberships(organization_id,id)
);
create table public.work_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, deal_id uuid not null,
 kind text not null default 'service' check(kind in('service','task')), parent_service_id uuid, catalog_id uuid,
 name text not null, description text, department_id uuid not null, assignee_id uuid,
 status text not null default 'todo' check(status in('todo','doing','done')), quantity numeric not null default 1 check(quantity>0),
 billing_interval text not null default 'once' check(billing_interval in('once','monthly')),
 due_at timestamptz, starts_at timestamptz, ends_at timestamptz, archived boolean not null default false,
 version bigint not null default 1, created_at timestamptz not null default now(),
 unique(organization_id,id), unique(organization_id,deal_id,id),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id),
 foreign key(organization_id,deal_id,parent_service_id) references public.work_items(organization_id,deal_id,id),
 foreign key(organization_id,catalog_id) references public.service_catalog(organization_id,id),
 foreign key(organization_id,department_id) references public.departments(organization_id,id),
 foreign key(organization_id,assignee_id) references public.memberships(organization_id,id)
);
create index work_deal on public.work_items(organization_id,deal_id) where not archived;
create index work_department on public.work_items(organization_id,department_id,deal_id) where not archived;
create index work_assignee on public.work_items(organization_id,assignee_id,status,due_at) where not archived;
create table public.work_prices (
 organization_id uuid not null, work_id uuid not null, amount bigint check(amount>=0),
 primary key(organization_id,work_id), foreign key(organization_id,work_id) references public.work_items(organization_id,id)
);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 deal_id uuid, actor_id uuid references auth.users, source text not null default 'user', action text not null,
 visibility text not null default 'object' check(visibility in('object','commercial','finance','admin')),
 before_data jsonb, after_data jsonb, reason text, created_at timestamptz not null default now(),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id)
);
create index audit_source on public.audit_events(organization_id,deal_id,created_at desc);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, recipient_id uuid not null,
 deal_id uuid, event_key text not null, label text not null, read_at timestamptz, created_at timestamptz not null default now(),
 unique(organization_id,recipient_id,event_key),
 foreign key(organization_id,recipient_id) references public.memberships(organization_id,id),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id)
);
create table public.outbox_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 topic text not null, entity_id uuid, version bigint not null default 1,
 created_at timestamptz not null default now(), delivered_at timestamptz
);
create table public.job_runs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 type text not null, dedupe_key text not null, payload jsonb not null default '{}',
 status text not null default 'queued' check(status in('queued','running','done','failed')),
 attempts int not null default 0, run_after timestamptz not null default now(), locked_until timestamptz,
 last_error text, result jsonb, created_at timestamptz not null default now(), unique(organization_id,type,dedupe_key)
);
create index jobs_pending on public.job_runs(status,run_after) where status in('queued','running');

-- Trusted membership lookup avoids recursive RLS. No user-editable JWT role claims.
create function private.member_id(org uuid) returns uuid language sql stable security definer set search_path='' as $$
 select id from public.memberships where organization_id=org and user_id=auth.uid() and status='active'
 and (not is_admin or coalesce(auth.jwt()->>'aal','aal1')='aal2');
$$;
create function private.is_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where id=private.member_id(org) and is_admin);
$$;
create function private.permitted(org uuid, permission text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select m.is_admin or case m.overrides->>permission when 'allow' then true when 'deny' then false
 else permission=any(coalesce(r.permissions,array['commercials.read'])) end
 from public.memberships m left join public.roles r on r.organization_id=m.organization_id and r.id=m.role_id
 where m.id=private.member_id(org)),false);
$$;
create function private.participates(org uuid, d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and (
 exists(select 1 from public.deals where organization_id=org and id=d and private.member_id(org) in(created_by,accountable_id))
 or exists(select 1 from public.deal_members where organization_id=org and deal_id=d and member_id=private.member_id(org))
 or exists(select 1 from public.work_items where organization_id=org and deal_id=d and assignee_id=private.member_id(org) and not archived));
$$;
create function private.can_read_deal(org uuid, d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and (private.is_admin(org) or private.participates(org,d)
 or exists(select 1 from public.work_items w join public.department_members dm on dm.organization_id=w.organization_id and dm.department_id=w.department_id
 where w.organization_id=org and w.deal_id=d and not w.archived and dm.member_id=private.member_id(org))
 or exists(select 1 from public.deals x join public.department_members dm on dm.organization_id=x.organization_id and dm.department_id=x.intake_department_id
 where x.organization_id=org and x.id=d and dm.member_id=private.member_id(org)));
$$;
create function private.can_edit_deal(org uuid, d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and (private.is_admin(org) or exists(select 1 from public.deals
 where organization_id=org and id=d and private.member_id(org) in(created_by,accountable_id)));
$$;
create function private.can_pay_deal(org uuid, d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and (private.is_admin(org) or exists(select 1 from public.deals
 where organization_id=org and id=d and created_by=private.member_id(org)));
$$;
create function private.require_member(org uuid) returns uuid language plpgsql security invoker set search_path='' as $$
 declare m uuid:=private.member_id(org); begin if m is null then raise exception 'ACCESS_DENIED' using errcode='42501'; end if; return m; end;
$$;
create function private.require_admin(org uuid) returns void language plpgsql security invoker set search_path='' as $$
 begin if not private.is_admin(org) then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if; end;
$$;
-- Read-only Data API: write grants are never handed to callers; checked RPCs own mutations.
do $$declare t text; begin
 foreach t in array array['organizations','roles','memberships','departments','department_members','invitations','customers','customer_locations','contacts','service_catalog','catalog_prices','loss_reasons','pipeline_stages','deals','deal_members','work_items','work_prices','audit_events','notifications','outbox_events','job_runs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['roles','departments','department_members','customers','customer_locations','contacts','service_catalog','loss_reasons','pipeline_stages'] loop
 execute format('create policy tenant_read on public.%I for select to authenticated using(private.member_id(organization_id) is not null)',t);
 end loop;
end $$;
create policy org_read on public.organizations for select to authenticated using(private.member_id(id) is not null);
create policy member_read on public.memberships for select to authenticated using(user_id=auth.uid() or private.member_id(organization_id) is not null);
create policy invite_read on public.invitations for select to authenticated using(private.is_admin(organization_id));
create policy catalog_price_read on public.catalog_prices for select to authenticated using(private.permitted(organization_id,'commercials.read'));
create policy deal_read on public.deals for select to authenticated using(private.can_read_deal(organization_id,id));
create policy participation_read on public.deal_members for select to authenticated using(private.can_read_deal(organization_id,deal_id));
create policy work_read on public.work_items for select to authenticated using(private.is_admin(organization_id) or private.participates(organization_id,deal_id));
create policy work_price_read on public.work_prices for select to authenticated using(private.permitted(organization_id,'commercials.read') and exists(select 1 from public.work_items w where w.id=work_id and w.organization_id=work_prices.organization_id));
create policy audit_read on public.audit_events for select to authenticated using(
 (deal_id is not null and private.can_read_deal(organization_id,deal_id) or deal_id is null and private.is_admin(organization_id))
 and case visibility when 'commercial' then private.permitted(organization_id,'commercials.read') when 'finance' then private.permitted(organization_id,'finance.read') or private.can_pay_deal(organization_id,deal_id) when 'admin' then private.is_admin(organization_id) else true end);
create policy notification_read on public.notifications for select to authenticated using(recipient_id=private.member_id(organization_id) and (deal_id is null or private.can_read_deal(organization_id,deal_id)));
create policy job_read on public.job_runs for select to authenticated using(private.is_admin(organization_id));
-- outbox has no client policy: delivered as minimal private invalidation, never row payloads.
grant execute on function private.member_id(uuid), private.is_admin(uuid), private.permitted(uuid,text), private.participates(uuid,uuid), private.can_read_deal(uuid,uuid), private.can_edit_deal(uuid,uuid), private.can_pay_deal(uuid,uuid), private.require_member(uuid), private.require_admin(uuid) to authenticated;
