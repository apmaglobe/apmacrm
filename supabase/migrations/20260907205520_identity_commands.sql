create function private.initialize_org(org uuid) returns void language plpgsql set search_path='' as $$
begin
 insert into public.departments(organization_id,name) values(org,'Marketing'),(org,'Development');
 insert into public.roles(organization_id,name,permissions) values(org,'Əməkdaş',array['commercials.read','commercials.write']);
 insert into public.loss_reasons(organization_id,name) select org,x from unnest(array['Büdcə uyğun deyil','Ehtiyac yoxdur','Vaxt uyğun deyil','Başqa təchizatçı seçildi','Əlaqə alınmadı','Digər']) x;
 insert into public.pipeline_stages(organization_id,code,pipeline,label,position)
 select org,code,case when n<=8 then 'sales' else 'recurring' end,label,n from
 unnest(array['to_call','called','proposal_sent','met','confirmed','in_progress','delivered','lost','recurring_todo','recurring_doing','recurring_done'],
 array['Zəng ediləcək','Zəng edilib','Təklif göndərildi','Görüşülüb','Sifariş təsdiqlənib','İcradadır','Təhvil verilib','Deal Lost','İcra olunacaq','İcrada','Bitdi']) with ordinality as x(code,label,n);
end; $$;
create function private.claim_bootstrap() returns uuid language plpgsql security definer set search_path='' as $$
declare b private.bootstrap_admins; u auth.users; org uuid; begin
 select * into u from auth.users where id=auth.uid();
 if u.id is null or u.email_confirmed_at is null or auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'VERIFIED_EMAIL_AND_MFA_REQUIRED' using errcode='42501'; end if;
 select * into b from private.bootstrap_admins where email=lower(u.email) for update;
 if b.email is null then raise exception 'BOOTSTRAP_NOT_AUTHORIZED' using errcode='42501'; end if;
 select id into org from public.organizations where slug=b.slug;
 if b.claimed_at is not null then return org; end if;
 insert into public.organizations(name,slug) values(b.organization_name,b.slug) returning id into org;
 perform private.initialize_org(org);
 insert into public.memberships(organization_id,user_id,name,status,is_admin) values(org,u.id,b.organization_name,'active',true);
 update private.bootstrap_admins set claimed_at=now() where email=b.email;
 return org;
end; $$;
create function public.claim_bootstrap() returns uuid language sql security invoker set search_path='' as $$select private.claim_bootstrap();$$;
grant execute on function private.claim_bootstrap(), public.claim_bootstrap() to authenticated;

create function private.join_organization(join_token uuid, display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid; m uuid; begin
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='42501'; end if;
 select id into org from public.organizations o where o.join_token=join_organization.join_token;
 if org is null then raise exception 'INVALID_JOIN_LINK'; end if;
 insert into public.memberships(organization_id,user_id,name,status,role_id)
 values(org,auth.uid(),left(coalesce(nullif(trim(display_name),''),'Əməkdaş'),120),'pending',(select id from public.roles where organization_id=org and name='Əməkdaş'))
 on conflict(organization_id,user_id) do nothing;
 select id into m from public.memberships where organization_id=org and user_id=auth.uid(); return m;
end; $$;
create function public.join_organization(join_token uuid,display_name text) returns uuid language sql security invoker set search_path='' as $$ select private.join_organization(join_token,display_name); $$;
grant execute on function private.join_organization(uuid,text),public.join_organization(uuid,text) to authenticated;

create function private.identity_command(org uuid, operation text, payload jsonb, expected_version bigint, request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; rid uuid; result jsonb; prior private.requests; old public.memberships; role_row public.roles;
begin
 m:=private.require_member(org); perform private.require_admin(org);
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=identity_command.request_id;
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
create function public.identity_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.identity_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.identity_command(uuid,text,jsonb,bigint,uuid), public.identity_command(uuid,text,jsonb,bigint,uuid) to authenticated;
