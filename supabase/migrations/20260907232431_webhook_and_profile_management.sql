alter table public.memberships add column avatar_path text;
alter table public.pipeline_stages add column version bigint not null default 1;
alter table public.webhook_endpoints add column version bigint not null default 1;
create table private.webhook_keys(endpoint_id uuid primary key references public.webhook_endpoints, current_secret uuid not null, previous_secret uuid, previous_until timestamptz);
alter table private.webhook_keys enable row level security;
create policy internal_only on private.webhook_keys for all to authenticated using(false) with check(false);
revoke all on private.webhook_keys from public,anon,authenticated;
-- Vault is not an exposed schema. Plaintext keys are never stored in request/audit/outbox rows.
revoke all on vault.decrypted_secrets,vault.secrets from anon,authenticated;
alter function private.identity_command(uuid,text,jsonb,bigint,uuid) rename to identity_command_v1;
create or replace function private.identity_command_v1(org uuid, operation text, payload jsonb, expected_version bigint, request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; rid uuid; result jsonb; prior private.requests; old public.memberships; role_row public.roles;
begin
 m:=private.require_member(org); perform private.require_admin(org);
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=identity_command_v1.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return prior.result; end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if operation='member.update' then
 select * into old from public.memberships where organization_id=org and id=rid for update;
 if old.id is null then raise exception 'NOT_FOUND'; end if;
 if old.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if old.is_admin and old.status='active' and (coalesce(payload->>'status',old.status)<>'active' or not coalesce((payload->>'is_admin')::boolean,old.is_admin))
 and not exists(select 1 from public.memberships where organization_id=org and id<>rid and is_admin and status='active') then raise exception 'LAST_ADMIN'; end if;
 if payload ? 'overrides' and exists(select 1 from jsonb_each_text(payload->'overrides') e where e.value not in('allow','deny','inherit')) then raise exception 'INVALID_OVERRIDE'; end if;
 update public.memberships set status=coalesce(payload->>'status',status),is_admin=coalesce((payload->>'is_admin')::boolean,is_admin),
 role_id=case when payload ? 'role_id' then nullif(payload->>'role_id','')::uuid else role_id end,
 overrides=coalesce(payload->'overrides',overrides),name=coalesce(nullif(trim(payload->>'name'),''),name),
 skills=case when payload ? 'skills' then array(select jsonb_array_elements_text(payload->'skills')) else skills end,version=version+1 where id=rid;
 if payload ? 'departments' then
 delete from public.department_members where organization_id=org and member_id=rid;
 insert into public.department_members(organization_id,member_id,department_id) select org,rid,value::uuid from jsonb_array_elements_text(payload->'departments');
 end if;
 elsif operation='role.save' then
 select * into role_row from public.roles where organization_id=org and id=rid for update;
 if found and role_row.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 insert into public.roles(id,organization_id,name,permissions) values(rid,org,payload->>'name',array(select jsonb_array_elements_text(payload->'permissions')))
 on conflict(id) do update set name=excluded.name,permissions=excluded.permissions,archived=coalesce((payload->>'archived')::boolean,roles.archived),version=roles.version+1 where roles.organization_id=org;
 elsif operation='department.save' then
 if exists(select 1 from public.departments where id=rid and organization_id=org and version<>expected_version) then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 insert into public.departments(id,organization_id,name) values(rid,org,payload->>'name') on conflict(id) do update set name=excluded.name,archived=coalesce((payload->>'archived')::boolean,departments.archived),version=departments.version+1 where departments.organization_id=org;
 elsif operation='loss_reason.save' then
 if exists(select 1 from public.loss_reasons where id=rid and organization_id=org and version<>expected_version) then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 insert into public.loss_reasons(id,organization_id,name) values(rid,org,payload->>'name') on conflict(id) do update set name=excluded.name,archived=coalesce((payload->>'archived')::boolean,loss_reasons.archived),version=loss_reasons.version+1 where loss_reasons.organization_id=org;
 elsif operation='catalog.save' then
 if exists(select 1 from public.service_catalog where id=rid and organization_id=org and version<>expected_version) then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 insert into public.service_catalog(id,organization_id,department_id,name,description,task_templates) values(rid,org,(payload->>'department_id')::uuid,payload->>'name',payload->>'description',coalesce(payload->'task_templates','[]'))
 on conflict(id) do update set department_id=excluded.department_id,name=excluded.name,description=excluded.description,task_templates=excluded.task_templates,archived=coalesce((payload->>'archived')::boolean,service_catalog.archived),version=service_catalog.version+1 where service_catalog.organization_id=org;
 insert into public.catalog_prices(organization_id,service_id,amount) values(org,rid,(payload->>'amount')::bigint) on conflict(organization_id,service_id) do update set amount=excluded.amount;
 else raise exception 'UNKNOWN_OPERATION'; end if;
 result:=jsonb_build_object('id',rid);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data,reason) values(org,auth.uid(),operation,'admin',jsonb_build_object('id',rid),payload->>'reason');
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'membership',rid);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 return result;
end; $$;
create function private.identity_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid;rid uuid;prior private.requests;result jsonb;secret_value text;secret_id uuid;old public.webhook_endpoints;current_v bigint;begin
 if operation not in('profile.save','organization.save','stage.save','webhook.save','webhook.rotate','webhook.retry') then return private.identity_command_v1(org,operation,payload,expected_version,request_id);end if;
 m:=private.require_member(org);if operation<>'profile.save' then perform private.require_admin(org);end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=identity_command.request_id;
 if found then
 if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 result:=prior.result;
 if result ? 'secret_id' then select decrypted_secret into secret_value from vault.decrypted_secrets where id=(result->>'secret_id')::uuid;return (result-'secret_id')||jsonb_build_object('signing_secret',secret_value);end if;
 return result;end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if operation='profile.save' then
 if payload-array['name','skills','avatar_path']<>'{}' then raise exception 'FIELD_DENIED';end if;
 if nullif(trim(payload->>'name'),'') is null then raise exception 'NAME_REQUIRED';end if;
 if payload->>'avatar_path' is not null and (not starts_with(payload->>'avatar_path',org::text||'/avatars/'||auth.uid()::text||'/') or not exists(select 1 from storage.objects where bucket_id='crm-private' and name=payload->>'avatar_path')) then raise exception 'INVALID_MEDIA';end if;
 update public.memberships set name=left(trim(payload->>'name'),120),skills=array(select left(value,80) from jsonb_array_elements_text(coalesce(payload->'skills','[]'))),avatar_path=coalesce(payload->>'avatar_path',avatar_path),version=version+1 where id=m and version=expected_version returning id,version into rid,current_v;
 elsif operation='organization.save' then
 if nullif(trim(payload->>'name'),'') is null then raise exception 'NAME_REQUIRED';end if;
 if payload->>'logo_path' is not null and (not starts_with(payload->>'logo_path',org::text||'/logos/'||org::text||'/') or not exists(select 1 from storage.objects where bucket_id='crm-private' and name=payload->>'logo_path')) then raise exception 'INVALID_MEDIA';end if;
 update public.organizations set name=left(trim(payload->>'name'),120),logo_path=coalesce(payload->>'logo_path',logo_path),version=version+1 where id=org and version=expected_version returning id,version into rid,current_v;
 elsif operation='stage.save' then
 if nullif(trim(payload->>'label'),'') is null or coalesce(payload->>'color','')!~'^#[0-9a-fA-F]{6}$' then raise exception 'INVALID_STAGE';end if;
 update public.pipeline_stages set label=left(trim(payload->>'label'),120),color=payload->>'color',version=version+1 where organization_id=org and code=payload->>'code' and version=expected_version returning version into current_v;
 rid:=org;
 elsif operation in('webhook.save','webhook.rotate') then
 select * into old from public.webhook_endpoints where organization_id=org and id=rid for update;
 if old.id is not null and old.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation='webhook.save' then
 if nullif(trim(payload->>'name'),'') is null then raise exception 'NAME_REQUIRED';end if;
 if not exists(select 1 from public.memberships where organization_id=org and id=(payload->>'default_admin_id')::uuid and status='active' and is_admin) then raise exception 'DEFAULT_ADMIN_UNAVAILABLE';end if;
 if not exists(select 1 from public.departments where organization_id=org and id=(payload->>'department_id')::uuid and not archived) then raise exception 'INVALID_DEPARTMENT';end if;
 insert into public.webhook_endpoints(id,organization_id,name,department_id,default_admin_id,enabled) values(rid,org,left(payload->>'name',120),(payload->>'department_id')::uuid,(payload->>'default_admin_id')::uuid,coalesce((payload->>'enabled')::boolean,true))
 on conflict(id) do update set name=excluded.name,department_id=excluded.department_id,default_admin_id=excluded.default_admin_id,enabled=excluded.enabled,version=webhook_endpoints.version+1 where webhook_endpoints.organization_id=org returning version into current_v;
 else
 if old.id is null then raise exception 'NOT_FOUND';end if;
 update public.webhook_endpoints set version=version+1 where id=rid returning version into current_v;
 end if;
 if old.id is null or operation='webhook.rotate' then
 secret_value:=encode(extensions.gen_random_bytes(32),'hex');
 secret_id:=vault.create_secret(secret_value,'apma-webhook:'||rid::text||':'||request_id::text,'APMA CRM endpoint signing key');
 insert into private.webhook_keys(endpoint_id,current_secret) values(rid,secret_id) on conflict(endpoint_id) do update set previous_secret=webhook_keys.current_secret,previous_until=now()+interval '5 minutes',current_secret=excluded.current_secret;
 end if;
 elsif operation='webhook.retry' then
 update public.webhook_events set status='queued',attempts=0,last_error=null where organization_id=org and id=rid and status='failed';current_v:=1;
 end if;
 if current_v is null then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 result:=jsonb_build_object('id',rid,'version',current_v);if secret_id is not null then result:=result||jsonb_build_object('secret_id',secret_id);end if;
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(org,auth.uid(),operation,'admin',jsonb_build_object('id',rid,'version',current_v));
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'settings',rid);
 if secret_id is not null then result:=(result-'secret_id')||jsonb_build_object('signing_secret',secret_value);end if;
 return result;
end;$$;
create or replace function public.identity_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.identity_command(org,operation,payload,expected_version,request_id);$$;
revoke all on function private.identity_command(uuid,text,jsonb,bigint,uuid),private.identity_command_v1(uuid,text,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function private.identity_command(uuid,text,jsonb,bigint,uuid) to authenticated;
create function private.webhook_signing_keys(endpoint uuid) returns text[] language sql stable security definer set search_path='' as $$
 select array_agg(s.decrypted_secret) from private.webhook_keys k join public.webhook_endpoints e on e.id=k.endpoint_id and e.enabled join vault.decrypted_secrets s on s.id=k.current_secret or (s.id=k.previous_secret and k.previous_until>now()) where k.endpoint_id=endpoint;
$$;
create function public.webhook_signing_keys(endpoint uuid) returns text[] language sql security invoker set search_path='' as $$select private.webhook_signing_keys(endpoint);$$;
revoke all on function private.webhook_signing_keys(uuid),public.webhook_signing_keys(uuid) from public,anon,authenticated;
grant execute on function private.webhook_signing_keys(uuid),public.webhook_signing_keys(uuid) to service_role;
create or replace function private.accept_webhook(endpoint uuid,payload jsonb,payload_hash text) returns uuid language plpgsql security definer set search_path='' as $$declare e public.webhook_endpoints;ev public.webhook_events;n int;begin
 select * into e from public.webhook_endpoints ep where ep.id=accept_webhook.endpoint and ep.enabled;if e.id is null then raise exception 'ENDPOINT_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock(hashtextextended(e.organization_id::text,0));
 insert into private.webhook_rate values(endpoint,date_trunc('minute',now()),1) on conflict(endpoint_id,minute) do update set count=private.webhook_rate.count+1 returning count into n;
 if n>60 then raise exception 'RATE_LIMIT';end if;
 select * into ev from public.webhook_events we where we.organization_id=e.organization_id and we.endpoint_id=accept_webhook.endpoint and we.external_event_id=accept_webhook.payload->>'external_event_id';
 if ev.id is not null then if ev.payload_hash<>accept_webhook.payload_hash then raise exception 'PAYLOAD_CONFLICT';end if;return ev.id;end if;
 if (select count(*) from public.webhook_events where organization_id=e.organization_id and created_at>now()-interval '1 day')>=10000 then raise exception 'RATE_LIMIT';end if;
 insert into public.webhook_events(organization_id,endpoint_id,external_event_id,payload,payload_hash) values(e.organization_id,endpoint,accept_webhook.payload->>'external_event_id',accept_webhook.payload,accept_webhook.payload_hash) returning id into ev.id;return ev.id;
end;$$;
