create or replace function private.import_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.import_jobs;r jsonb;c public.customers;cid uuid;ext text;idx int;lim int;result jsonb;prior private.requests;change record;loc_before jsonb;con_before jsonb;begin
 perform private.require_admin(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=import_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if operation='import.inspect' then
 if jsonb_array_length(payload->'rows')>10000 then raise exception 'IMPORT_LIMIT';end if;
 return (select jsonb_build_object('candidates',coalesce(jsonb_agg(jsonb_build_object('index',n-1,'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',candidate.id,'name',candidate.name,'external_id',candidate.external_id)),'[]') from public.customers candidate where candidate.organization_id=org and not candidate.archived and (lower(trim(candidate.name))=lower(trim(rw->>'customer_name')) or candidate.external_id=nullif(rw->>'external_id',''))))),'[]')) from jsonb_array_elements(payload->'rows') with ordinality x(rw,n));
 elsif operation='import.preview' then
 if jsonb_array_length(payload->'rows') not between 1 and 10000 or octet_length((payload->'rows')::text)>52428800 then raise exception 'IMPORT_LIMIT';end if;
 for r in select * from jsonb_array_elements(payload->'rows') loop
 if nullif(trim(r->>'customer_name'),'') is null then raise exception 'CUSTOMER_NAME_REQUIRED';end if;
 if exists(select 1 from jsonb_each_text(r) where length(value)>4000) then raise exception 'CELL_LIMIT';end if;
 if (r->>'latitude')::float not between -90 and 90 or (r->>'longitude')::float not between -180 and 180 then raise exception 'INVALID_COORDINATES';end if;
 end loop;
 insert into public.import_jobs(organization_id,file_hash,mapping,rows,created_by,storage_path) values(org,payload->>'file_hash',payload->'mapping',payload->'rows',auth.uid(),payload->>'storage_path')
 on conflict(organization_id,file_hash,mapping) do update set file_hash=excluded.file_hash returning * into job;
 elsif operation='import.apply' then
 select * into job from public.import_jobs where organization_id=org and id=(payload->>'id')::uuid for update;
 if job.id is null then raise exception 'NOT_FOUND';end if;
 if job.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if job.status='rolled_back' then raise exception 'IMPORT_ROLLED_BACK';end if;
 lim:=least(job.cursor+200,jsonb_array_length(job.rows));
 for idx in job.cursor..lim-1 loop
 r:=job.rows->idx;ext:=coalesce(nullif(r->>'external_id',''),'file:'||job.file_hash||':'||idx);
 if nullif(r->>'match_customer_id','') is not null then
 select external_id into ext from public.customers where organization_id=org and id=(r->>'match_customer_id')::uuid and not archived;
 if not found then raise exception 'INVALID_CUSTOMER_MATCH';end if;end if;
 select * into c from public.customers where organization_id=org and external_id=ext for update;
 select coalesce(jsonb_agg(to_jsonb(l)),'[]') into loc_before from public.customer_locations l where organization_id=org and customer_id=c.id;
 select coalesce(jsonb_agg(to_jsonb(l)),'[]') into con_before from public.contacts l where organization_id=org and customer_id=c.id;
 insert into public.customers(organization_id,external_id,name,category,note) values(org,ext,r->>'customer_name',nullif(r->>'category',''),nullif(r->>'note',''))
 on conflict(organization_id,external_id) do update set name=coalesce(nullif(excluded.name,''),customers.name),category=coalesce(excluded.category,customers.category),note=coalesce(excluded.note,customers.note),version=customers.version+1 returning id into cid;
 insert into private.import_changes(organization_id,job_id,row_index,customer_id,before_data,after_version) values(org,job.id,idx,cid,case when c.id is null then null else to_jsonb(c) end,coalesce(c.version,0)+1);
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
 update private.import_changes set locations_before=loc_before,contacts_before=con_before,
 locations_after=(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from public.customer_locations l where organization_id=org and customer_id=cid),
 contacts_after=(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from public.contacts l where organization_id=org and customer_id=cid)
 where organization_id=org and job_id=job.id and row_index=idx;
 end loop;
 update public.import_jobs set cursor=lim,status=case when lim=jsonb_array_length(rows) then 'done' else 'running' end,version=version+1 where id=job.id returning * into job;
 elsif operation='import.rollback' then
 select * into job from public.import_jobs where organization_id=org and id=(payload->>'id')::uuid for update;
 if job.id is null then raise exception 'NOT_FOUND';end if;
 if job.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 for change in select distinct on(first_change.customer_id) first_change.*,
 (select max(last_change.after_version) from private.import_changes last_change where last_change.organization_id=org and last_change.job_id=job.id and last_change.customer_id=first_change.customer_id) final_version,
 (select last_change.locations_after from private.import_changes last_change where last_change.organization_id=org and last_change.job_id=job.id and last_change.customer_id=first_change.customer_id order by row_index desc limit 1) final_locations,
 (select last_change.contacts_after from private.import_changes last_change where last_change.organization_id=org and last_change.job_id=job.id and last_change.customer_id=first_change.customer_id order by row_index desc limit 1) final_contacts
 from private.import_changes first_change where first_change.organization_id=org and first_change.job_id=job.id order by first_change.customer_id,first_change.row_index loop
 select * into c from public.customers where organization_id=org and id=change.customer_id for update;
 if c.version<>change.final_version then raise exception 'ROLLBACK_SUBSEQUENT_CHANGE';end if;
 if exists(select 1 from public.customer_locations l where l.organization_id=org and l.customer_id=c.id and not exists(select 1 from jsonb_array_elements(change.final_locations) x where (x->>'id')::uuid=l.id and (x->>'version')::bigint=l.version))
 or exists(select 1 from public.contacts l where l.organization_id=org and l.customer_id=c.id and not exists(select 1 from jsonb_array_elements(change.final_contacts) x where (x->>'id')::uuid=l.id and (x->>'version')::bigint=l.version)) then raise exception 'ROLLBACK_SUBSEQUENT_CHANGE';end if;
 delete from public.contacts where organization_id=org and customer_id=c.id;
 delete from public.customer_locations where organization_id=org and customer_id=c.id;
 insert into public.customer_locations select (jsonb_populate_record(null::public.customer_locations,jsonb_set(x,'{version}',to_jsonb(coalesce((select (a->>'version')::bigint from jsonb_array_elements(change.final_locations) a where a->>'id'=x->>'id'),(x->>'version')::bigint)+1)))).* from jsonb_array_elements(change.locations_before) x;
 insert into public.contacts select (jsonb_populate_record(null::public.contacts,jsonb_set(x,'{version}',to_jsonb(coalesce((select (a->>'version')::bigint from jsonb_array_elements(change.final_contacts) a where a->>'id'=x->>'id'),(x->>'version')::bigint)+1)))).* from jsonb_array_elements(change.contacts_before) x;
 if change.before_data is null then
 if exists(select 1 from public.deals where organization_id=org and customer_id=c.id) or exists(select 1 from public.service_contracts where organization_id=org and customer_id=c.id) or exists(select 1 from public.financial_documents where organization_id=org and customer_id=c.id) then raise exception 'ROLLBACK_CUSTOMER_IN_USE';end if;
 delete from public.customers where organization_id=org and id=c.id;
 else update public.customers set name=change.before_data->>'name',category=change.before_data->>'category',note=change.before_data->>'note',version=c.version+1 where organization_id=org and id=c.id;end if;
 end loop;
 update public.import_jobs set status='rolled_back',version=version+1 where id=job.id returning * into job;
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

