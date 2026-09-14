-- A sales box can be opened before its customer is known.  The existing
-- confirmation validation still requires a customer, prices and deadlines.
do $$
declare definition text;
begin
 select pg_get_functiondef('private.crm_command_base(uuid,text,jsonb,bigint,uuid)'::regprocedure) into definition;
 definition:=replace(definition,
  ' or nullif(payload->>''customer_id'','''') is null','');
 definition:=replace(definition,
  '(payload->>''customer_id'')::uuid','nullif(payload->>''customer_id'','''')::uuid');
 execute definition;
end;$$;

alter table public.customer_locations add column if not exists archived boolean not null default false;
create index if not exists customer_locations_active_map on public.customer_locations(organization_id,customer_id) where not archived;

create function private.map_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.requests; loc public.customer_locations; cid uuid; lid uuid; lat double precision; lng double precision; result jsonb;
begin
 perform private.require_admin(org);
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if request_id is null or jsonb_typeof(payload)<>'object' then raise exception 'INVALID_INPUT'; end if;
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=map_command.request_id;
 if found then
  if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return prior.result;
 end if;
 if operation='location.save' then
  cid:=nullif(payload->>'customer_id','')::uuid;
  if cid is null or not exists(select 1 from public.customers where organization_id=org and id=cid and not archived) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  lat:=nullif(payload->>'latitude','')::double precision; lng:=nullif(payload->>'longitude','')::double precision;
  if (lat is null)<>(lng is null) or lat not between -90 and 90 or lng not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
  lid:=nullif(payload->>'id','')::uuid;
  if lid is null then
   lid:=gen_random_uuid();
   insert into public.customer_locations(id,organization_id,customer_id,external_id,name,address,latitude,longitude,manual_pin)
    values(lid,org,cid,'manual:'||lid::text,nullif(btrim(payload->>'name'),''),nullif(btrim(payload->>'address'),''),lat,lng,true);
  else
   select * into loc from public.customer_locations where organization_id=org and id=lid for update;
   if loc.id is null then raise exception 'NOT_FOUND'; end if;
   if loc.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
   update public.customer_locations set customer_id=cid,name=nullif(btrim(payload->>'name'),''),address=nullif(btrim(payload->>'address'),''),latitude=lat,longitude=lng,manual_pin=true,archived=false,version=version+1 where id=lid;
  end if;
 elsif operation='location.delete' then
  lid:=nullif(payload->>'id','')::uuid;
  select * into loc from public.customer_locations where organization_id=org and id=lid for update;
  if loc.id is null then raise exception 'NOT_FOUND'; end if;
  if loc.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  update public.customer_locations set archived=true,version=version+1 where id=lid;
 else raise exception 'UNKNOWN_OPERATION'; end if;
 result:=jsonb_build_object('id',lid);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(org,auth.uid(),operation,'admin',result);
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'customers',lid);
 return result;
end;$$;
create function public.map_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.map_command(org,operation,payload,expected_version,request_id);$$;
revoke all on function private.map_command(uuid,text,jsonb,bigint,uuid),public.map_command(uuid,text,jsonb,bigint,uuid) from public,anon;
grant execute on function private.map_command(uuid,text,jsonb,bigint,uuid),public.map_command(uuid,text,jsonb,bigint,uuid) to authenticated;
