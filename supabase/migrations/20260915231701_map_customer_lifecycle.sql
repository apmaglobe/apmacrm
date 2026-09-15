-- Preserve historical deals while allowing an admin or a record owner to retire map data.
alter table public.customers add column if not exists created_by uuid references public.memberships(id);
alter table public.customer_locations add column if not exists created_by uuid references public.memberships(id);
update public.customers c set created_by=(select m.id from public.memberships m where m.organization_id=c.organization_id and m.status='active' and m.is_admin order by m.joined_at limit 1) where c.created_by is null;
update public.customer_locations l set created_by=c.created_by from public.customers c where c.organization_id=l.organization_id and c.id=l.customer_id and l.created_by is null;
create index if not exists customers_creator_active on public.customers(organization_id,created_by) where not archived;

create function private.can_manage_customer(org uuid, customer uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and exists(select 1 from public.customers c where c.organization_id=org and c.id=customer and (private.is_admin(org) or c.created_by=private.member_id(org)));
$$;
grant execute on function private.can_manage_customer(uuid,uuid) to authenticated;

create or replace function private.map_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.requests; loc public.customer_locations; customer public.customers; cid uuid; lid uuid; lat double precision; lng double precision; result jsonb; m uuid;
begin
 m:=private.require_member(org);
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 if request_id is null or jsonb_typeof(payload)<>'object' then raise exception 'INVALID_INPUT'; end if;
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=map_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if; return prior.result; end if;
 if operation='customer.save' then
  cid:=nullif(payload->>'id','')::uuid;
  if cid is null then
   if not private.permitted(org,'map.write') then raise exception 'MAP_WRITE_REQUIRED' using errcode='42501'; end if;
   if nullif(btrim(payload->>'name'),'') is null then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
   cid:=gen_random_uuid();
   insert into public.customers(id,organization_id,external_id,name,category,note,created_by) values(cid,org,'manual:'||cid::text,btrim(payload->>'name'),nullif(btrim(payload->>'category'),''),nullif(btrim(payload->>'note'),''),m);
  else
   select * into customer from public.customers where organization_id=org and id=cid for update;
   if customer.id is null then raise exception 'NOT_FOUND'; end if;
   if not private.can_manage_customer(org,cid) then raise exception 'CUSTOMER_MANAGER_REQUIRED' using errcode='42501'; end if;
   if customer.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
   if nullif(btrim(payload->>'name'),'') is null then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
   update public.customers set name=btrim(payload->>'name'),category=nullif(btrim(payload->>'category'),''),note=nullif(btrim(payload->>'note'),''),version=version+1 where organization_id=org and id=cid;
  end if;
 elsif operation='customer.delete' then
  cid:=nullif(payload->>'id','')::uuid;
  select * into customer from public.customers where organization_id=org and id=cid for update;
  if customer.id is null then raise exception 'NOT_FOUND'; end if;
  if not private.can_manage_customer(org,cid) then raise exception 'CUSTOMER_MANAGER_REQUIRED' using errcode='42501'; end if;
  if customer.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  update public.customers set archived=true,version=version+1 where organization_id=org and id=cid;
  update public.customer_locations set archived=true,version=version+1 where organization_id=org and customer_id=cid and not archived;
 elsif operation='location.save' then
  cid:=nullif(payload->>'customer_id','')::uuid;
  if cid is null or not exists(select 1 from public.customers where organization_id=org and id=cid and not archived) then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not private.can_manage_customer(org,cid) then raise exception 'CUSTOMER_MANAGER_REQUIRED' using errcode='42501'; end if;
  lat:=nullif(payload->>'latitude','')::double precision; lng:=nullif(payload->>'longitude','')::double precision;
  if (lat is null)<>(lng is null) or lat not between -90 and 90 or lng not between -180 and 180 then raise exception 'INVALID_COORDINATES'; end if;
  lid:=nullif(payload->>'id','')::uuid;
  if lid is null then lid:=gen_random_uuid(); insert into public.customer_locations(id,organization_id,customer_id,external_id,name,address,latitude,longitude,manual_pin,created_by) values(lid,org,cid,'manual:'||lid::text,nullif(btrim(payload->>'name'),''),nullif(btrim(payload->>'address'),''),lat,lng,true,m);
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
  if not private.can_manage_customer(org,loc.customer_id) then raise exception 'CUSTOMER_MANAGER_REQUIRED' using errcode='42501'; end if;
  if loc.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
  update public.customer_locations set archived=true,version=version+1 where id=lid;
 else raise exception 'UNKNOWN_OPERATION'; end if;
 result:=jsonb_build_object('id',coalesce(cid,lid));
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(org,auth.uid(),operation,'admin',result);
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'customers',coalesce(cid,lid));
 return result;
end;$$;
