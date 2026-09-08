-- New membership is visible in other active sessions, once per completed provisioning job.
create or replace function private.complete_member(org uuid,job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'membership',mid);
 return jsonb_build_object('id',mid,'completed',true);
end;$$;
