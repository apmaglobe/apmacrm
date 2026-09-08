create table public.import_jobs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 file_hash text not null, mapping jsonb not null, rows jsonb not null, status text not null default 'preview' check(status in('preview','running','done','failed','rolled_back')),
 cursor int not null default 0, errors jsonb not null default '[]', version bigint not null default 1,
 created_by uuid not null references auth.users, created_at timestamptz not null default now(), unique(organization_id,id),unique(organization_id,file_hash,mapping)
);
create table private.import_changes (
 organization_id uuid not null, job_id uuid not null, row_index int not null, customer_id uuid not null,
 before_data jsonb, after_version bigint not null, primary key(organization_id,job_id,row_index),
 foreign key(organization_id,job_id) references public.import_jobs(organization_id,id)
);
alter table public.import_jobs enable row level security;revoke all on public.import_jobs from anon,authenticated;grant select on public.import_jobs to authenticated;
create policy import_admin on public.import_jobs for select to authenticated using(private.is_admin(organization_id));
create function private.import_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.import_jobs;r jsonb;c public.customers;cid uuid;ext text;idx int;lim int;result jsonb;prior private.requests;begin
 perform private.require_admin(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=import_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if operation='import.preview' then
 if jsonb_array_length(payload->'rows') not between 1 and 10000 or octet_length((payload->'rows')::text)>52428800 then raise exception 'IMPORT_LIMIT';end if;
 for r in select * from jsonb_array_elements(payload->'rows') loop
 if nullif(trim(r->>'customer_name'),'') is null then raise exception 'CUSTOMER_NAME_REQUIRED';end if;
 if exists(select 1 from jsonb_each_text(r) where length(value)>4000) then raise exception 'CELL_LIMIT';end if;
 if (r->>'latitude')::float not between -90 and 90 or (r->>'longitude')::float not between -180 and 180 then raise exception 'INVALID_COORDINATES';end if;
 end loop;
 insert into public.import_jobs(organization_id,file_hash,mapping,rows,created_by) values(org,payload->>'file_hash',payload->'mapping',payload->'rows',auth.uid())
 on conflict(organization_id,file_hash,mapping) do update set file_hash=excluded.file_hash returning * into job;
 elsif operation='import.apply' then
 select * into job from public.import_jobs where organization_id=org and id=(payload->>'id')::uuid for update;
 if job.id is null then raise exception 'NOT_FOUND';end if;
 if job.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 lim:=least(job.cursor+200,jsonb_array_length(job.rows));
 for idx in job.cursor..lim-1 loop
 r:=job.rows->idx;ext:=coalesce(nullif(r->>'external_id',''),'file:'||job.file_hash||':'||idx);
 select * into c from public.customers where organization_id=org and external_id=ext for update;
 insert into public.customers(organization_id,external_id,name,category,note) values(org,ext,r->>'customer_name',nullif(r->>'category',''),nullif(r->>'note',''))
 on conflict(organization_id,external_id) do update set name=coalesce(nullif(excluded.name,''),customers.name),category=coalesce(excluded.category,customers.category),note=coalesce(excluded.note,customers.note),version=customers.version+1 returning id into cid;
 insert into private.import_changes values(org,job.id,idx,cid,case when c.id is null then null else to_jsonb(c) end,coalesce(c.version,0)+1);
 if coalesce(r->>'address',r->>'branch_name',r->>'latitude') is not null then
 insert into public.customer_locations(organization_id,customer_id,external_id,name,address,latitude,longitude)
 values(org,cid,coalesce(nullif(r->>'location_external_id',''),'row:'||idx),nullif(r->>'branch_name',''),nullif(r->>'address',''),nullif(r->>'latitude','')::float,nullif(r->>'longitude','')::float)
 on conflict(organization_id,customer_id,external_id) do update set name=coalesce(excluded.name,customer_locations.name),address=coalesce(excluded.address,customer_locations.address),
 latitude=case when customer_locations.manual_pin then customer_locations.latitude else coalesce(excluded.latitude,customer_locations.latitude) end,
 longitude=case when customer_locations.manual_pin then customer_locations.longitude else coalesce(excluded.longitude,customer_locations.longitude) end,version=customer_locations.version+1;
 end if;
 if coalesce(nullif(r->>'phone',''),nullif(r->>'email',''),nullif(r->>'contact_name','')) is not null then
 insert into public.contacts(organization_id,customer_id,external_id,name,phone,email) values(org,cid,'row:'||idx,nullif(r->>'contact_name',''),nullif(r->>'phone',''),nullif(r->>'email',''))
 on conflict(organization_id,customer_id,external_id) do update set name=coalesce(excluded.name,contacts.name),phone=coalesce(excluded.phone,contacts.phone),email=coalesce(excluded.email,contacts.email),version=contacts.version+1;end if;
 end loop;
 update public.import_jobs set cursor=lim,status=case when lim=jsonb_array_length(rows) then 'done' else 'running' end,version=version+1 where id=job.id returning * into job;
 elsif operation='customer.update' then
 select * into c from public.customers where organization_id=org and id=(payload->>'id')::uuid for update;
 if c.id is null then raise exception 'NOT_FOUND';end if;if c.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 update public.customers set name=coalesce(nullif(trim(payload->>'name'),''),name),category=coalesce(payload->>'category',category),note=coalesce(payload->>'note',note),archived=coalesce((payload->>'archived')::boolean,archived),version=version+1 where id=c.id;
 elsif operation='location.pin' then
 update public.customer_locations set latitude=(payload->>'latitude')::float,longitude=(payload->>'longitude')::float,manual_pin=true,version=version+1
 where organization_id=org and id=(payload->>'id')::uuid and version=expected_version;
 if not found then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 else raise exception 'UNKNOWN_OPERATION';end if;
 result:=jsonb_build_object('id',coalesce(job.id,c.id),'cursor',job.cursor,'status',job.status,'version',job.version);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data) values(org,auth.uid(),operation,'admin',result);
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'customers',coalesce(job.id,c.id));return result;
end;$$;
create function public.import_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.import_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.import_command(uuid,text,jsonb,bigint,uuid),public.import_command(uuid,text,jsonb,bigint,uuid) to authenticated;
