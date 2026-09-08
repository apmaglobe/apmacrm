alter table public.payments add column version bigint not null default 1;
create or replace function private.finance_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid;prior private.requests;result jsonb;p public.payments;f public.financial_documents;d public.deals;a jsonb;pid uuid;rid uuid;total bigint;used bigint;open_amount bigint;single_deal uuid;rec record;begin
 m:=private.require_member(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=finance_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if operation='account.save' then
 perform private.require_admin(org);
 if exists(select 1 from public.financial_accounts where organization_id=org and id=rid and version<>expected_version) then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 insert into public.financial_accounts(id,organization_id,name,kind,opening_amount,as_of) values(rid,org,payload->>'name',payload->>'kind',coalesce((payload->>'opening_amount')::bigint,0),coalesce((payload->>'as_of')::date,current_date))
 on conflict(id) do update set name=excluded.name,archived=coalesce((payload->>'archived')::boolean,financial_accounts.archived),version=financial_accounts.version+1 where financial_accounts.organization_id=org;
 elsif operation='document.create' then
 perform private.require_admin(org);
 if payload->>'kind' not in('payable','opening_receivable','opening_payable') then raise exception 'INVALID_DOCUMENT_KIND';end if;
 insert into public.financial_documents(id,organization_id,customer_id,deal_id,kind,amount,source_key,reason,counterparty,category,due_date,actor_id)
 values(rid,org,nullif(payload->>'customer_id','')::uuid,nullif(payload->>'deal_id','')::uuid,payload->>'kind',(payload->>'amount')::bigint,'manual:'||request_id,payload->>'reason',payload->>'counterparty',payload->>'category',(payload->>'due_date')::date,auth.uid());
 elsif operation in('payment.create','payment.replace') then
 -- A non-admin must allocate the entire payment to exactly their own single sales order.
 if not private.is_admin(org) then
 if jsonb_array_length(coalesce(payload->'allocations','[]'))<>1 or coalesce(payload->>'direction','in')<>'in' then raise exception 'SINGLE_ORDER_PAYMENT_ONLY' using errcode='42501';end if;
 select * into f from public.financial_documents where organization_id=org and id=(payload->'allocations'->0->>'document_id')::uuid;
 if not private.can_pay_deal(org,f.deal_id) or f.kind<>'charge' or (payload->'allocations'->0->>'amount')::bigint<>(payload->>'amount')::bigint then raise exception 'SINGLE_ORDER_PAYMENT_ONLY' using errcode='42501';end if;
 single_deal:=f.deal_id;
 end if;
 if operation='payment.replace' then
 select * into p from public.payments where organization_id=org and id=(payload->>'replace_id')::uuid for update;
 if p.id is null or p.reversed_payment_id is not null or exists(select 1 from public.payments where organization_id=org and (reversed_payment_id=p.id or note='refund:'||p.id)) then raise exception 'INVALID_PAYMENT';end if;
 if p.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 if not private.is_admin(org) and (not private.payment_visible(org,p.id) or exists(select 1 from public.payment_allocations a join public.financial_documents fd on fd.id=a.document_id and fd.organization_id=a.organization_id where a.organization_id=org and a.payment_id=p.id and fd.deal_id is distinct from single_deal)) then raise exception 'SINGLE_ORDER_PAYMENT_ONLY' using errcode='42501';end if;
 insert into public.payments(organization_id,customer_id,account_id,direction,amount,payment_date,reversed_payment_id,reason,actor_id)
 values(org,p.customer_id,p.account_id,case p.direction when 'in' then 'out' else 'in' end,p.amount,now(),p.id,payload->>'reason',auth.uid());
 for rec in select * from public.payment_allocations pa where organization_id=org and payment_id=p.id and amount>0 and not exists(select 1 from public.payment_allocations ra where ra.reversal_of=pa.id) loop
 insert into public.payment_allocations(organization_id,payment_id,document_id,amount,reversal_of) values(org,p.id,rec.document_id,-rec.amount,rec.id);end loop;
 end if;
 if not exists(select 1 from public.financial_accounts where organization_id=org and id=(payload->>'account_id')::uuid and not archived) then raise exception 'INVALID_ACCOUNT';end if;
 insert into public.payments(id,organization_id,customer_id,account_id,direction,amount,payment_date,method,note,receipt_url,actor_id)
 values(rid,org,nullif(payload->>'customer_id','')::uuid,(payload->>'account_id')::uuid,coalesce(payload->>'direction','in'),(payload->>'amount')::bigint,(payload->>'payment_date')::timestamptz,coalesce(payload->>'method','bank'),payload->>'note',payload->>'receipt_url',auth.uid()) returning * into p;
 pid:=p.id;
 elsif operation='payment.allocate' then
 perform private.require_admin(org);pid:=(payload->>'id')::uuid;
 select * into p from public.payments where organization_id=org and id=pid for update;
 if p.id is null or p.reversed_payment_id is not null or exists(select 1 from public.payments where organization_id=org and reversed_payment_id=pid) then raise exception 'INVALID_PAYMENT';end if;
 elsif operation='payment.release' then
 perform private.require_admin(org);
 select * into p from public.payments where organization_id=org and id=(payload->>'payment_id')::uuid for update;
 if p.id is null then raise exception 'INVALID_PAYMENT';end if;
 if p.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 for rec in select * from public.payment_allocations a where a.organization_id=org and a.payment_id=p.id and a.amount>0 and not exists(select 1 from public.payment_allocations ra where ra.reversal_of=a.id) loop
 insert into public.payment_allocations(organization_id,payment_id,document_id,amount,reversal_of) values(org,p.id,rec.document_id,-rec.amount,rec.id);
 select * into f from public.financial_documents where organization_id=org and id=rec.document_id;
 if f.deal_id is not null then update public.deals set version=version+1 where organization_id=org and id=f.deal_id returning * into d;
 perform private.emit(org,d.id,operation,d.version,null,jsonb_build_object('payment_id',p.id),payload->>'reason','finance');end if;
 end loop;
 update public.payments set version=version+1 where organization_id=org and id=p.id;
 elsif operation='payment.refund' then
 perform private.require_admin(org);
 select * into p from public.payments where organization_id=org and id=(payload->>'payment_id')::uuid for update;
 if p.id is null or p.direction<>'in' or p.reversed_payment_id is not null or exists(select 1 from public.payments where organization_id=org and reversed_payment_id=p.id) then raise exception 'INVALID_PAYMENT';end if;
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 select coalesce(sum(amount),0) into used from public.payment_allocations where organization_id=org and payment_id=p.id;
 -- Refund the unallocated balance; allocation release is explicit and audited beforehand.
 select used+coalesce(sum(amount),0) into used from public.payments where organization_id=org and note='refund:'||p.id;
 if p.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if (payload->>'amount')::bigint>p.amount-used then raise exception 'REFUND_EXCEEDS_AVAILABLE';end if;
 insert into public.payments(id,organization_id,customer_id,account_id,direction,amount,payment_date,note,reason,actor_id)
 values(rid,org,p.customer_id,p.account_id,'out',(payload->>'amount')::bigint,(payload->>'payment_date')::timestamptz,'refund:'||p.id,payload->>'reason',auth.uid());
 update public.payments set version=version+1 where organization_id=org and id=p.id;
 else raise exception 'UNKNOWN_OPERATION';end if;
 if pid is not null then
 if operation='payment.allocate' then
 if p.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 update public.payments set version=version+1 where organization_id=org and id=p.id;end if;
 for a in select value from jsonb_array_elements(coalesce(payload->'allocations','[]')) order by value->>'document_id' loop
 select * into f from public.financial_documents where organization_id=org and id=(a->>'document_id')::uuid for update;
 if f.id is null or f.customer_id is distinct from p.customer_id or f.kind='adjustment' then raise exception 'ALLOCATION_SOURCE_MISMATCH';end if;
 if p.direction='in' and f.kind not in('charge','opening_receivable') or p.direction='out' and f.kind not in('payable','opening_payable') then raise exception 'ALLOCATION_DIRECTION';end if;
 select coalesce(sum(amount),0) into used from public.payment_allocations where organization_id=org and payment_id=pid;
 select used+coalesce(sum(amount),0) into used from public.payments where organization_id=org and note='refund:'||pid;
 if used+(a->>'amount')::bigint>p.amount then raise exception 'ALLOCATION_EXCEEDS_PAYMENT';end if;
 if f.deal_id is not null and f.kind='charge' then open_amount:=private.charge(org,f.deal_id)-private.paid(org,f.deal_id);
 else select f.amount-coalesce(sum(amount),0) into open_amount from public.payment_allocations where organization_id=org and document_id=f.id;end if;
 if (a->>'amount')::bigint<=0 or (a->>'amount')::bigint>open_amount then raise exception 'ALLOCATION_EXCEEDS_BALANCE';end if;
 insert into public.payment_allocations(organization_id,payment_id,document_id,amount) values(org,pid,f.id,(a->>'amount')::bigint);
 if f.deal_id is not null then
 update public.deals set version=version+1 where organization_id=org and id=f.deal_id returning * into d;
 perform private.emit(org,d.id,operation,d.version,null,jsonb_build_object('payment_id',pid),payload->>'reason','finance');end if;
 end loop;
 end if;
 result:=jsonb_build_object('id',rid);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data,reason) values(org,auth.uid(),operation,'finance',result,payload->>'reason');
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'finance',rid);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;

create function private.invite_create(org uuid,email_address text) returns text language plpgsql security definer set search_path='' as $$
declare token text;begin
 perform private.require_admin(org);
 if email_address !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'INVALID_EMAIL';end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.invitations(organization_id,email,token_hash,expires_at) values(org,lower(trim(email_address)),encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '7 days');
 insert into public.audit_events(organization_id,actor_id,action,visibility) values(org,auth.uid(),'invitation.created','admin');
 return token;end;$$;
create function public.invite_create(org uuid,email_address text) returns text language sql security invoker set search_path='' as $$select private.invite_create(org,email_address);$$;
create function private.invite_accept(token text,display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations;u auth.users;mid uuid;begin
 select * into u from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if u.id is null then raise exception 'VERIFIED_EMAIL_REQUIRED';end if;
 select * into i from public.invitations where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if i.id is null or lower(u.email)<>i.email or i.expires_at<now() or i.accepted_by is not null and i.accepted_by<>u.id then raise exception 'INVALID_INVITATION';end if;
 perform pg_advisory_xact_lock(hashtextextended(i.organization_id::text,0));
 insert into public.memberships(organization_id,user_id,name,status,role_id)
 values(i.organization_id,u.id,left(coalesce(nullif(trim(display_name),''),'Əməkdaş'),120),'pending',(select id from public.roles where organization_id=i.organization_id and name='Əməkdaş')) on conflict(organization_id,user_id) do nothing;
 select id into mid from public.memberships where organization_id=i.organization_id and user_id=u.id;
 update public.invitations set accepted_by=u.id where id=i.id;
 insert into public.outbox_events(organization_id,topic,entity_id) values(i.organization_id,'membership',mid);
 return mid;end;$$;
create function public.invite_accept(token text,display_name text) returns uuid language sql security invoker set search_path='' as $$select private.invite_accept(token,display_name);$$;
grant execute on function private.invite_create(uuid,text),public.invite_create(uuid,text),private.invite_accept(text,text),public.invite_accept(text,text) to authenticated;
alter table public.import_jobs add column storage_path text;
alter table private.import_changes add column locations_before jsonb not null default '[]';
alter table private.import_changes add column contacts_before jsonb not null default '[]';
alter table private.import_changes add column locations_after jsonb not null default '[]';
alter table private.import_changes add column contacts_after jsonb not null default '[]';
create or replace function private.import_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.import_jobs;r jsonb;c public.customers;cid uuid;ext text;idx int;lim int;result jsonb;prior private.requests;change record;loc_before jsonb;con_before jsonb;begin
 perform private.require_admin(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=import_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if operation='import.inspect' then
 if jsonb_array_length(payload->'rows')>10000 then raise exception 'IMPORT_LIMIT';end if;
 return (select jsonb_build_object('candidates',coalesce(jsonb_agg(jsonb_build_object('index',n-1,'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'external_id',c.external_id)),'[]') from public.customers c where c.organization_id=org and not c.archived and (lower(trim(c.name))=lower(trim(rw->>'customer_name')) or c.external_id=nullif(rw->>'external_id',''))))),'[]')) from jsonb_array_elements(payload->'rows') with ordinality x(rw,n));
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
