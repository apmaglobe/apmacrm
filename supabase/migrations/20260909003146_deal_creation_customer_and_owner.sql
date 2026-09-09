-- A small, manually entered customer is allowed only to an active admin.
-- Imports remain the bulk source of truth; this covers a newly won deal before an Excel refresh.
create function private.customer_create(
  org uuid,
  customer_name text,
  customer_category text,
  customer_note text,
  request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.requests; cid uuid; result jsonb; normalized text;
begin
  perform private.require_admin(org);
  perform pg_advisory_xact_lock(hashtextextended(org::text,0));
  if request_id is null then raise exception 'INVALID_INPUT'; end if;
  normalized := btrim(coalesce(customer_name,''));
  if length(normalized) = 0 or length(normalized) > 240 then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  select * into prior from private.requests r
   where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=customer_create.request_id;
  if found then
    if prior.operation<>'customer.create' or prior.payload<>jsonb_build_object('name',normalized,'category',customer_category,'note',customer_note) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  select id into cid from public.customers
   where organization_id=org and lower(btrim(name))=lower(normalized) and not archived
   order by created_at limit 1;
  if cid is null then
    cid:=gen_random_uuid();
    insert into public.customers(id,organization_id,external_id,name,category,note)
      values(cid,org,'manual:'||cid::text,normalized,nullif(btrim(customer_category),''),nullif(btrim(customer_note),''));
    insert into public.audit_events(organization_id,actor_id,action,visibility,after_data)
      values(org,auth.uid(),'customer.created','admin',jsonb_build_object('id',cid,'source','manual'));
    result:=jsonb_build_object('id',cid,'created',true);
  else
    result:=jsonb_build_object('id',cid,'created',false);
  end if;
  insert into private.requests values(org,auth.uid(),request_id,'customer.create',jsonb_build_object('name',normalized,'category',customer_category,'note',customer_note),result);
  return result;
end;$$;
create function public.customer_create(org uuid,customer_name text,customer_category text,customer_note text,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.customer_create(org,customer_name,customer_category,customer_note,request_id);$$;
revoke all on function private.customer_create(uuid,text,text,text,uuid),public.customer_create(uuid,text,text,text,uuid) from public,anon;
grant execute on function private.customer_create(uuid,text,text,text,uuid),public.customer_create(uuid,text,text,text,uuid) to authenticated;

-- Preserve the existing CRM command as the implementation, then add an explicit initial overall owner.
-- The wrapper uses a distinct internal request id so retry semantics remain stable.
alter function private.crm_command(uuid,text,jsonb,bigint,uuid) rename to crm_command_base;
create function private.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.requests; owner_id uuid; clean_payload jsonb; result jsonb; version_after bigint;
begin
  if operation<>'deal.create' or not (payload ? 'accountable_id') then
    return private.crm_command_base(org,operation,payload,expected_version,request_id);
  end if;
  perform private.require_member(org);
  perform pg_advisory_xact_lock(hashtextextended(org::text,0));
  select * into prior from private.requests r
   where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=crm_command.request_id;
  if found then
    if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior.result;
  end if;
  owner_id:=nullif(payload->>'accountable_id','')::uuid;
  if owner_id is null or not exists(select 1 from public.memberships where organization_id=org and id=owner_id and status='active') then raise exception 'INACTIVE_ASSIGNEE'; end if;
  clean_payload:=payload-'accountable_id';
  result:=private.crm_command_base(org,operation,clean_payload,expected_version,gen_random_uuid());
  update public.deals set accountable_id=owner_id,version=version+1
   where organization_id=org and id=(result->>'id')::uuid returning version into version_after;
  result:=jsonb_set(result,'{version}',to_jsonb(version_after));
  perform private.emit(org,(result->>'id')::uuid,'deal.accountable_assigned',version_after,null,jsonb_build_object('accountable_id',owner_id));
  insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
  return result;
end;$$;
create or replace function public.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.crm_command(org,operation,payload,expected_version,request_id);$$;
revoke all on function private.crm_command_base(uuid,text,jsonb,bigint,uuid) from public,anon,authenticated;
revoke all on function private.crm_command(uuid,text,jsonb,bigint,uuid),public.crm_command(uuid,text,jsonb,bigint,uuid) from public,anon;
grant execute on function private.crm_command(uuid,text,jsonb,bigint,uuid),public.crm_command(uuid,text,jsonb,bigint,uuid) to authenticated;
