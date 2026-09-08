-- Export artifacts live in a private DB relation for 24 hours. No public/signed object URL bypasses current rights.
create table public.export_jobs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 user_id uuid not null references auth.users, request_id uuid not null, module text not null,
 filters jsonb not null default '{}', format text not null check(format in('csv','xlsx')),
 status text not null default 'queued' check(status in('queued','done','failed','expired')),
 attempts int not null default 0, last_error text, created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours', unique(user_id,request_id)
);
create index export_jobs_org on public.export_jobs(organization_id,user_id,created_at desc);
create index export_jobs_pending on public.export_jobs(created_at) where status='queued';
create index export_jobs_expiry on public.export_jobs(expires_at) where status<>'expired';
alter table public.export_jobs enable row level security;
revoke all on public.export_jobs from public,anon,authenticated;
grant select on public.export_jobs to authenticated;
create policy own_export on public.export_jobs for select to authenticated using(user_id=(select auth.uid()) and private.member_id(organization_id) is not null);
create table private.export_artifacts(job_id uuid primary key references public.export_jobs on delete cascade, data jsonb not null);
alter table private.export_artifacts enable row level security;
create policy internal_only on private.export_artifacts for all to authenticated using(false) with check(false);
revoke all on private.export_artifacts from public,anon,authenticated;

-- These predicates use the same object checks as the Data API RLS policies. Only literal whitelisted SQL is returned.
create function private.export_predicate(t text) returns text language plpgsql immutable set search_path='' as $$begin
 return case t
 when 'deal_cards' then 'private.can_read_deal(r.organization_id,r.id)'
 when 'work_items' then '(private.is_admin(r.organization_id) or private.participates(r.organization_id,r.deal_id))'
 when 'work_prices' then 'private.permitted(r.organization_id,''commercials.read'') and exists(select 1 from public.work_items w where w.organization_id=r.organization_id and w.id=r.work_id and (private.is_admin(w.organization_id) or private.participates(w.organization_id,w.deal_id)))'
 when 'financial_documents' then 'private.permitted(r.organization_id,''finance.read'')'
 when 'payments' then 'private.permitted(r.organization_id,''finance.read'')'
 when 'payment_allocations' then 'private.permitted(r.organization_id,''finance.read'')'
 when 'service_contracts' then 'private.is_admin(r.organization_id)'
 when 'contract_periods' then 'private.is_admin(r.organization_id)'
 when 'portfolio_items' then 'private.can_read_deal(r.organization_id,r.deal_id)'
 when 'resource_links' then 'private.can_read_deal(r.organization_id,r.deal_id)'
 when 'meetings' then 'private.can_meet(r.organization_id,r.id)'
 when 'customers' then 'true' when 'customer_locations' then 'true' when 'contacts' then 'true'
 when 'tools' then 'true' when 'tool_reservations' then 'true' when 'memberships' then 'true'
 else null end;
end;$$;
create function private.export_tables(m text) returns text[] language sql immutable set search_path='' as $$select case m
 when 'crm' then array['deal_cards','work_items','work_prices'] when 'map' then array['customers','customer_locations','contacts']
 when 'todo' then array['work_items'] when 'finance' then array['financial_documents','payments','payment_allocations']
 when 'subscriptions' then array['service_contracts','contract_periods'] when 'tools' then array['tools','tool_reservations']
 when 'meetings' then array['meetings'] when 'portfolio' then array['portfolio_items'] when 'drive' then array['resource_links']
 when 'users' then array['memberships'] end;$$;
create function private.export_access(org uuid,m text) returns void language plpgsql stable security definer set search_path='' as $$begin
 perform private.require_member(org);
 if private.export_tables(m) is null or not private.permitted(org,m||'.export') or (m='finance' and not private.permitted(org,'finance.read')) or (m='subscriptions' and not private.is_admin(org)) then raise exception 'EXPORT_DENIED' using errcode='42501';end if;
end;$$;
create function private.export_snapshot(org uuid,m text,filters jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 elsif search<>'' and t in('customers','deal_cards','work_items','tools','meetings','resource_links','memberships') then
 clause:=clause||format(' and strpos(lower(coalesce(r.%I,'''')),lower(%L))>0',case when t in('deal_cards','meetings','resource_links') then 'title' else 'name' end,search);
 end if;
 if t in('customers','deal_cards','work_items') then clause:=clause||' and not r.archived';end if;
 if t='deal_cards' and filters->>'pipeline' in('sales','recurring') then clause:=clause||format(' and r.pipeline=%L',filters->>'pipeline');end if;
 if m='todo' and coalesce(filters->>'scope','own')<>'shared' and not (private.is_admin(org) and filters->>'scope'='team') then clause:=clause||format(' and r.assignee_id=%L::uuid',private.member_id(org));end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)-array[''user_id'',''overrides'',''join_token'',''template_snapshot'',''intake''] order by r.%I),''[]'') from public.%I r where r.organization_id=$1 and (%s)',case when t='work_prices' then 'work_id' else 'id' end,t,clause) into rows using org;
 -- The definer context must not make view-derived price columns bypass field permission.
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
 select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 result:=result||jsonb_build_array(jsonb_build_object('table',t,'rows',rows));
 end loop;return result;
end;$$;
create function private.process_exports() returns int language plpgsql security definer set search_path='' as $$
declare j public.export_jobs;claims text:=current_setting('request.jwt.claims',true);n int:=0;snapshot jsonb;begin
 for j in select * from public.export_jobs where status='queued' and attempts<3 and expires_at>now() order by created_at limit 3 for update skip locked loop
 begin
 -- Actor came from an authenticated enqueue, never a caller-provided user ID. Current membership is rechecked below.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',j.user_id,'role','authenticated','aal','aal2')::text,true);
 snapshot:=private.export_snapshot(j.organization_id,j.module,j.filters);
 insert into private.export_artifacts values(j.id,snapshot) on conflict(job_id) do update set data=excluded.data;
 update public.export_jobs set status='done',attempts=attempts+1,last_error=null where id=j.id;n:=n+1;
 exception when others then update public.export_jobs set attempts=attempts+1,status=case when attempts+1>=3 or sqlstate='42501' then 'failed' else 'queued' end,last_error=case when sqlstate='42501' then 'EXPORT_DENIED' else 'EXPORT_FAILED' end where id=j.id;
 end;
 end loop;
 perform set_config('request.jwt.claims',coalesce(claims,''),true);
 delete from private.export_artifacts a using public.export_jobs expired_job where a.job_id=expired_job.id and expired_job.expires_at<=now();
 update public.export_jobs set status='expired' where expires_at<=now() and status<>'expired';return n;
end;$$;
create function private.export_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.export_jobs;m text:=payload->>'module';begin
 if operation<>'create' then raise exception 'UNKNOWN_OPERATION';end if;
 perform private.export_access(org,m);
 if payload->>'format' not in('csv','xlsx') then raise exception 'INVALID_FORMAT';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,91));
 select * into j from public.export_jobs where user_id=auth.uid() and export_jobs.request_id=export_command.request_id;
 if j.id is not null then
 if j.organization_id<>org or j.module<>m or j.filters<>coalesce(payload->'filters','{}') or j.format<>payload->>'format' then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return jsonb_build_object('id',j.id,'status',j.status);end if;
 if (select count(*) from public.export_jobs where organization_id=org and user_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'EXPORT_RATE_LIMIT';end if;
 insert into public.export_jobs(organization_id,user_id,request_id,module,filters,format) values(org,auth.uid(),request_id,m,coalesce(payload->'filters','{}'),payload->>'format') returning * into j;
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(org,auth.uid(),'export.created','admin',jsonb_build_object('id',j.id,'module',m));
 return jsonb_build_object('id',j.id,'status',j.status);
end;$$;
create function private.download_export(org uuid,job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.export_jobs;artifact jsonb;part jsonb;rows jsonb;result jsonb:='[]';t text;key text;begin
 select * into j from public.export_jobs where id=job and organization_id=org and user_id=auth.uid();
 if j.id is null then raise exception 'EXPORT_DENIED' using errcode='42501';end if;
 perform private.export_access(org,j.module);
 if j.status<>'done' or j.expires_at<=now() then raise exception 'EXPORT_NOT_READY';end if;
 select data into artifact from private.export_artifacts where job_id=job;
 for part in select value from jsonb_array_elements(artifact) loop
 t:=part->>'table';key:=case when t='work_prices' then 'work_id' else 'id' end;
 -- Revalidate every source row at download, including object/dept/assignee revocations since the snapshot.
 execute format('select coalesce(jsonb_agg(e.value),''[]'') from jsonb_array_elements($2) e where exists(select 1 from public.%I r where r.organization_id=$1 and r.%I::text=e.value->>%L and (%s))',t,key,key,private.export_predicate(t)) into rows using org,part->'rows';
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
 select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 result:=result||jsonb_build_array(jsonb_build_object('table',t,'rows',rows));end loop;
 return jsonb_build_object('module',j.module,'format',j.format,'tables',result);
end;$$;
create function public.export_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.export_command(org,operation,payload,expected_version,request_id);$$;
create function public.download_export(org uuid,job uuid) returns jsonb language sql security invoker set search_path='' as $$select private.download_export(org,job);$$;
create function public.process_exports() returns int language sql security invoker set search_path='' as $$select private.process_exports();$$;
revoke all on function private.export_predicate(text),private.export_tables(text),private.export_access(uuid,text),private.export_snapshot(uuid,text,jsonb),private.process_exports(),private.export_command(uuid,text,jsonb,bigint,uuid),private.download_export(uuid,uuid),public.export_command(uuid,text,jsonb,bigint,uuid),public.download_export(uuid,uuid),public.process_exports() from public,anon,authenticated;
grant execute on function private.export_command(uuid,text,jsonb,bigint,uuid),public.export_command(uuid,text,jsonb,bigint,uuid),private.download_export(uuid,uuid),public.download_export(uuid,uuid) to authenticated;
grant execute on function private.process_exports(),public.process_exports() to service_role;
select cron.schedule('apma-export-worker','* * * * *','select private.process_exports()');
