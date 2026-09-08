create table public.financial_accounts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 name text not null, kind text not null check(kind in('cash','bank')), opening_amount bigint not null default 0,
 as_of date not null default current_date, archived boolean not null default false, version bigint not null default 1, unique(organization_id,id)
);
create table public.financial_documents (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, customer_id uuid, deal_id uuid,
 kind text not null check(kind in('charge','adjustment','payable','opening_receivable','opening_payable')),
 amount bigint not null, source_key text not null, linked_id uuid, reason text,
 counterparty text, category text check(category in('freelancer','supplier','salary','office')),
 due_date date, actor_id uuid references auth.users, created_at timestamptz not null default now(),
 unique(organization_id,id),unique(organization_id,source_key),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id),
 foreign key(organization_id,linked_id) references public.financial_documents(organization_id,id),
 check(kind='adjustment' or amount>=0),check(kind<>'adjustment' or length(trim(reason))>0)
);
create index financial_deal on public.financial_documents(organization_id,deal_id);
create table public.payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, customer_id uuid, account_id uuid not null,
 direction text not null check(direction in('in','out')), amount bigint not null check(amount>0),
 payment_date timestamptz not null, method text not null default 'bank', note text, receipt_url text,
 reversed_payment_id uuid, reason text, actor_id uuid not null references auth.users,
 created_at timestamptz not null default now(), unique(organization_id,id),unique(organization_id,reversed_payment_id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,account_id) references public.financial_accounts(organization_id,id),
 foreign key(organization_id,reversed_payment_id) references public.payments(organization_id,id)
);
create table public.payment_allocations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, payment_id uuid not null,
 document_id uuid not null, amount bigint not null check(amount<>0), reversal_of uuid,
 created_at timestamptz not null default now(), unique(organization_id,id),unique(organization_id,reversal_of),
 foreign key(organization_id,payment_id) references public.payments(organization_id,id),
 foreign key(organization_id,document_id) references public.financial_documents(organization_id,id),
 foreign key(organization_id,reversal_of) references public.payment_allocations(organization_id,id),
 check(amount>0 or reversal_of is not null)
);
create index allocation_document on public.payment_allocations(organization_id,document_id);
create index allocation_payment on public.payment_allocations(organization_id,payment_id);
create table public.portfolio_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, deal_id uuid not null,
 status text not null check(status in('draft','completed','archived')), unique(organization_id,deal_id),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id)
);
create table public.deal_comments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, deal_id uuid not null,
 actor_id uuid not null, body text not null check(length(trim(body)) between 1 and 4000), created_at timestamptz not null default now(),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id),
 foreign key(organization_id,actor_id) references public.memberships(organization_id,id)
);
create function private.total(org uuid,d uuid,once_only boolean default false) returns bigint language sql stable set search_path='' as $$
 select case when count(*)=0 or count(p.amount)<>count(*) then null else sum(p.amount)::bigint end
 from public.work_items w left join public.work_prices p on p.organization_id=w.organization_id and p.work_id=w.id
 where w.organization_id=org and w.deal_id=d and not w.archived and w.kind='service' and (not once_only or w.billing_interval='once');
$$;
create function private.charge(org uuid,d uuid) returns bigint language sql stable set search_path='' as $$select sum(amount)::bigint from public.financial_documents where organization_id=org and deal_id=d and kind in('charge','adjustment');$$;
create function private.paid(org uuid,d uuid) returns bigint language sql stable set search_path='' as $$
 select coalesce(sum(a.amount),0)::bigint from public.payment_allocations a join public.financial_documents f on f.organization_id=a.organization_id and f.id=a.document_id
 where f.organization_id=org and f.deal_id=d;
$$;
create function private.price_summary(org uuid,d uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 begin if not private.can_read_deal(org,d) or not private.permitted(org,'commercials.read') then return null; end if;
 return jsonb_build_object('total',private.total(org,d)); end;
$$;
create function public.price_summary(org uuid,d uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.price_summary(org,d);$$;
grant execute on function private.price_summary(uuid,uuid),public.price_summary(uuid,uuid) to authenticated;
create function private.payment_visible(org uuid,p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.permitted(org,'finance.read') or (private.member_id(org) is not null and
 exists(select 1 from public.payment_allocations a join public.financial_documents f on f.id=a.document_id and f.organization_id=a.organization_id
 where a.organization_id=org and a.payment_id=p and private.can_pay_deal(org,f.deal_id))
 and not exists(select 1 from public.payment_allocations a join public.financial_documents f on f.id=a.document_id and f.organization_id=a.organization_id
 where a.organization_id=org and a.payment_id=p and not private.can_pay_deal(org,f.deal_id))
 and (select coalesce(sum(amount),0) from public.payment_allocations where organization_id=org and payment_id=p)=(select amount from public.payments where organization_id=org and id=p));
$$;
grant execute on function private.payment_visible(uuid,uuid) to authenticated;
do $$declare t text;begin
 foreach t in array array['financial_accounts','financial_documents','payments','payment_allocations','portfolio_items','deal_comments'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end$$;
create policy account_read on public.financial_accounts for select to authenticated using(private.member_id(organization_id) is not null);
create policy document_read on public.financial_documents for select to authenticated using(private.permitted(organization_id,'finance.read') or private.can_pay_deal(organization_id,deal_id));
create policy payment_read on public.payments for select to authenticated using(private.payment_visible(organization_id,id));
create policy allocation_read on public.payment_allocations for select to authenticated using(private.payment_visible(organization_id,payment_id));
create policy portfolio_read on public.portfolio_items for select to authenticated using(private.can_read_deal(organization_id,deal_id));
create policy comment_read on public.deal_comments for select to authenticated using(private.can_read_deal(organization_id,deal_id));
-- Account opening balances are financial data, separate projection for payment selectors.
drop policy account_read on public.financial_accounts;
create policy account_finance_read on public.financial_accounts for select to authenticated using(private.permitted(organization_id,'finance.read'));
create function private.account_options(org uuid) returns table(id uuid,name text) language plpgsql stable security definer set search_path='' as $$begin perform private.require_member(org);return query select a.id,a.name from public.financial_accounts a where a.organization_id=org and not a.archived;end;$$;
create function public.account_options(org uuid) returns table(id uuid,name text) language sql stable security invoker set search_path='' as $$select * from private.account_options(org);$$;
grant execute on function private.account_options(uuid),public.account_options(uuid) to authenticated;

create function private.emit(org uuid,d uuid,act text,ver bigint,before_value jsonb default null,after_value jsonb default null,reason text default null,visibility text default 'object')
returns void language plpgsql set search_path='' as $$begin
 insert into public.audit_events(organization_id,deal_id,actor_id,action,visibility,before_data,after_data,reason) values(org,d,auth.uid(),act,visibility,before_value,after_value,reason);
 insert into public.outbox_events(organization_id,topic,entity_id,version) values(org,'deal',d,ver);
 insert into public.notifications(organization_id,recipient_id,deal_id,event_key,label)
 select org,m.id,d,d::text||':'||ver::text||':'||act,'Qutuda yenilik var'
 from public.memberships m where m.organization_id=org and m.status='active' and m.user_id is distinct from auth.uid() and
 (exists(select 1 from public.deals x where x.id=d and x.organization_id=org and m.id in(x.created_by,x.accountable_id))
 or exists(select 1 from public.work_items w where w.organization_id=org and w.deal_id=d and w.assignee_id=m.id and not w.archived)
 or exists(select 1 from public.deal_members dm where dm.organization_id=org and dm.deal_id=d and dm.member_id=m.id)) on conflict do nothing;
end;$$;
create function private.validate_deal(org uuid,d uuid) returns void language plpgsql set search_path='' as $$
declare x public.deals; w public.work_items; total bigint;begin
 select * into x from public.deals where organization_id=org and id=d;
 if not exists(select 1 from public.pipeline_stages where organization_id=org and code=x.stage and pipeline=x.pipeline) then raise exception 'INVALID_STAGE';end if;
 if x.accountable_id is not null and not exists(select 1 from public.memberships where organization_id=org and id=x.accountable_id and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 if x.location_id is not null and not exists(select 1 from public.customer_locations where organization_id=org and id=x.location_id and customer_id=x.customer_id) then raise exception 'LOCATION_CUSTOMER_MISMATCH';end if;
 for w in select * from public.work_items where organization_id=org and deal_id=d and not archived loop
 if w.due_at>x.due_at then raise exception 'CHILD_DEADLINE_EXCEEDS_PARENT';end if;
 if w.assignee_id is not null and not exists(select 1 from public.memberships where organization_id=org and id=w.assignee_id and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 if not exists(select 1 from public.departments where organization_id=org and id=w.department_id and not archived) then raise exception 'INACTIVE_DEPARTMENT';end if;
 if w.parent_service_id is not null and not exists(select 1 from public.work_items where organization_id=org and id=w.parent_service_id and deal_id=d and kind='service') then raise exception 'INVALID_PARENT_SERVICE';end if;
 end loop;
 if x.first_confirmed_at is not null or x.pipeline='recurring' or x.stage in('confirmed','in_progress','delivered') then
 total:=private.total(org,d);
 if x.customer_id is null or x.due_at is null or total is null then raise exception 'CONFIRMATION_FIELDS_REQUIRED';end if;
 if exists(select 1 from public.work_items where organization_id=org and deal_id=d and not archived and (assignee_id is null or due_at is null)) then raise exception 'WORK_FIELDS_REQUIRED';end if;
 if total=0 and nullif(trim(x.zero_reason),'') is null then raise exception 'ZERO_REASON_REQUIRED';end if;
 end if;
end;$$;
create function private.sync_charge(org uuid,d uuid,reason text,reconcile boolean default false) returns void language plpgsql set search_path='' as $$
declare x public.deals; total bigint; old_total bigint; allocated bigint; excess bigint; a record; root uuid; take bigint;begin
 select * into x from public.deals where organization_id=org and id=d;
 if x.first_confirmed_at is null then return;end if;
 total:=coalesce(private.total(org,d,x.pipeline='sales'),0);old_total:=private.charge(org,d);
 if old_total is null then
 insert into public.financial_documents(organization_id,customer_id,deal_id,kind,amount,source_key,actor_id)
 values(org,x.customer_id,d,'charge',total,'deal:'||d||':charge',auth.uid()) on conflict(organization_id,source_key) do nothing;return;
 end if;
 if total=old_total then return;end if;
 if nullif(trim(reason),'') is null then raise exception 'PRICE_CHANGE_REASON_REQUIRED';end if;
 allocated:=private.paid(org,d);
 if total<allocated then
 if not private.is_admin(org) or not reconcile then raise exception 'ADMIN_RECONCILIATION_REQUIRED';end if;
 excess:=allocated-total;
 for a in select pa.* from public.payment_allocations pa join public.financial_documents f on f.organization_id=pa.organization_id and f.id=pa.document_id
 where f.organization_id=org and f.deal_id=d and pa.amount>0 and not exists(select 1 from public.payment_allocations r where r.reversal_of=pa.id) order by pa.id for update of pa loop
 -- Reverse whole allocation then reallocate the retained amount; original is immutable.
 take:=least(excess,a.amount);
 insert into public.payment_allocations(organization_id,payment_id,document_id,amount,reversal_of) values(org,a.payment_id,a.document_id,-a.amount,a.id);
 if a.amount>take then insert into public.payment_allocations(organization_id,payment_id,document_id,amount) values(org,a.payment_id,a.document_id,a.amount-take);end if;
 excess:=excess-take;exit when excess=0;end loop;
 end if;
 select id into root from public.financial_documents where organization_id=org and deal_id=d and kind='charge';
 insert into public.financial_documents(organization_id,customer_id,deal_id,kind,amount,source_key,linked_id,reason,actor_id)
 values(org,x.customer_id,d,'adjustment',total-old_total,'deal:'||d||':version:'||x.version,root,reason,auth.uid());
end;$$;

create function private.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; d uuid; w uuid; x public.deals; old_work public.work_items; item jsonb; prior private.requests; result jsonb; num bigint; yr int; amount_changed boolean:=false; open_ids uuid[]; old_price bigint;begin
 m:=private.require_member(org);
 -- Lock ordering is tenant -> deal -> money. This also serializes permission revocation with writes.
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=crm_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if operation='deal.create' then
 if payload ?| array['created_by','accountable_id','creation_source','stage','total','organization_id'] then raise exception 'FORBIDDEN_FIELD';end if;
 if jsonb_array_length(coalesce(payload->'works','[]'))=0 or nullif(payload->>'customer_id','') is null then raise exception 'CUSTOMER_AND_WORK_REQUIRED';end if;
 yr:=extract(year from now() at time zone 'Asia/Baku');
 insert into private.serials values(org,yr,1) on conflict(organization_id,year) do update set value=private.serials.value+1 returning value into num;
 insert into public.deals(organization_id,serial,title,customer_id,location_id,created_by,accountable_id,creation_source,due_at,zero_reason)
 values(org,'CRM-'||yr||'-'||lpad(num::text,6,'0'),nullif(trim(payload->>'title'),''),(payload->>'customer_id')::uuid,nullif(payload->>'location_id','')::uuid,m,m,'manual',nullif(payload->>'due_at','')::timestamptz,payload->>'zero_reason') returning * into x;d:=x.id;
 for item in select * from jsonb_array_elements(payload->'works') loop
 if item->>'amount' is not null and not private.permitted(org,'commercials.write') then raise exception 'COMMERCIAL_WRITE_REQUIRED' using errcode='42501';end if;
 insert into public.work_items(organization_id,deal_id,name,department_id,assignee_id,catalog_id,due_at,billing_interval)
 values(org,d,item->>'name',(item->>'department_id')::uuid,coalesce(nullif(item->>'assignee_id','')::uuid,m),nullif(item->>'catalog_id','')::uuid,nullif(item->>'due_at','')::timestamptz,coalesce(item->>'billing_interval','once')) returning id into w;
 insert into public.work_prices values(org,w,nullif(item->>'amount','')::bigint);
 end loop;
 else
 d:=(payload->>'deal_id')::uuid;
 select * into x from public.deals where organization_id=org and id=d for update;
 if x.id is null or not private.can_read_deal(org,d) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if x.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation not in('work.status','comment.add') and not private.can_edit_deal(org,d) then raise exception 'EDIT_DENIED' using errcode='42501';end if;
 if operation='deal.stage' then
 if x.stage in('delivered','lost','recurring_done') and x.stage is distinct from payload->>'stage' and nullif(trim(payload->>'reason'),'') is null then raise exception 'REOPEN_REASON_REQUIRED';end if;
 if payload->>'stage'='lost' and not exists(select 1 from public.loss_reasons where organization_id=org and id=nullif(payload->>'loss_reason_id','')::uuid and not archived) then raise exception 'LOSS_REASON_REQUIRED';end if;
 select array_agg(id) into open_ids from public.work_items where organization_id=org and deal_id=d and not archived and status<>'done';
 if payload->>'stage'='recurring_done' and cardinality(open_ids)>0 and nullif(trim(payload->>'reason'),'') is null then raise exception 'OPEN_WORK_REASON_REQUIRED';end if;
 update public.deals set stage=payload->>'stage',loss_reason_id=case when payload->>'stage'='lost' then (payload->>'loss_reason_id')::uuid else loss_reason_id end,
 completion_reason=case when payload->>'stage'='recurring_done' then payload->>'reason' else completion_reason end,
 open_work_snapshot=case when payload->>'stage'='recurring_done' then coalesce(open_ids,'{}') else open_work_snapshot end,
 first_confirmed_at=case when payload->>'stage' in('confirmed','in_progress','delivered') then coalesce(first_confirmed_at,now()) else first_confirmed_at end,
 delivered_at=case when payload->>'stage' in('delivered','recurring_done') then coalesce(delivered_at,now()) else delivered_at end where id=d;
 elsif operation='deal.update' then
 if payload ?| array['created_by','creation_source','pipeline','stage','total'] then raise exception 'FORBIDDEN_FIELD';end if;
 if payload ? 'due_at' and x.due_at is distinct from nullif(payload->>'due_at','')::timestamptz and nullif(trim(payload->>'reason'),'') is null then raise exception 'DEADLINE_REASON_REQUIRED';end if;
 if x.first_confirmed_at is not null and payload ? 'customer_id' and x.customer_id is distinct from (payload->>'customer_id')::uuid then raise exception 'CONFIRMED_CUSTOMER_IMMUTABLE';end if;
 update public.deals set title=case when payload ? 'title' then payload->>'title' else title end,
 customer_id=case when payload ? 'customer_id' then (payload->>'customer_id')::uuid else customer_id end,
 accountable_id=case when payload ? 'accountable_id' then (payload->>'accountable_id')::uuid else accountable_id end,
 due_at=case when payload ? 'due_at' then nullif(payload->>'due_at','')::timestamptz else due_at end,
 zero_reason=coalesce(payload->>'zero_reason',zero_reason),archived=coalesce((payload->>'archived')::boolean,archived) where id=d;
 elsif operation='participant.set' then
 if not exists(select 1 from public.memberships where organization_id=org and id=(payload->>'member_id')::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 if (payload->>'enabled')::boolean then insert into public.deal_members values(org,d,(payload->>'member_id')::uuid) on conflict do nothing;
 else delete from public.deal_members where organization_id=org and deal_id=d and member_id=(payload->>'member_id')::uuid;end if;
 elsif operation in('work.save','work.status') then
 w:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select * into old_work from public.work_items where organization_id=org and deal_id=d and id=w;
 if operation='work.status' then
 if payload - array['deal_id','id','status'] <> '{}'::jsonb then raise exception 'FORBIDDEN_FIELD';end if;
 if old_work.id is null or (old_work.assignee_id is distinct from m and not private.can_edit_deal(org,d)) then raise exception 'OWN_WORK_ONLY' using errcode='42501';end if;
 update public.work_items set status=payload->>'status',version=version+1 where id=w;
 else
 if old_work.id is not null and payload ? 'due_at' and old_work.due_at is distinct from nullif(payload->>'due_at','')::timestamptz and nullif(trim(payload->>'reason'),'') is null then raise exception 'DEADLINE_REASON_REQUIRED';end if;
 amount_changed:=payload ? 'amount' or old_work.id is null and coalesce(payload->>'kind','service')='service' or payload ? 'archived' and coalesce(old_work.kind,'service')='service';
 if amount_changed and not (private.is_admin(org) or private.can_edit_deal(org,d) and private.permitted(org,'commercials.write')) then raise exception 'COMMERCIAL_WRITE_REQUIRED' using errcode='42501';end if;
 if old_work.id is null then
 insert into public.work_items(id,organization_id,deal_id,kind,parent_service_id,catalog_id,name,description,department_id,assignee_id,due_at,billing_interval)
 values(w,org,d,coalesce(payload->>'kind','service'),nullif(payload->>'parent_service_id','')::uuid,nullif(payload->>'catalog_id','')::uuid,payload->>'name',payload->>'description',(payload->>'department_id')::uuid,nullif(payload->>'assignee_id','')::uuid,nullif(payload->>'due_at','')::timestamptz,coalesce(payload->>'billing_interval','once'));
 else
 update public.work_items set name=coalesce(payload->>'name',name),description=coalesce(payload->>'description',description),
 department_id=coalesce(nullif(payload->>'department_id','')::uuid,department_id),assignee_id=case when payload ? 'assignee_id' then nullif(payload->>'assignee_id','')::uuid else assignee_id end,
 due_at=case when payload ? 'due_at' then nullif(payload->>'due_at','')::timestamptz else due_at end,archived=coalesce((payload->>'archived')::boolean,archived),version=version+1 where id=w;
 end if;
 if coalesce(old_work.kind,payload->>'kind','service')='service' and (payload ? 'amount' or old_work.id is null) then
 select amount into old_price from public.work_prices where organization_id=org and work_id=w;
 insert into public.work_prices values(org,w,nullif(payload->>'amount','')::bigint) on conflict(organization_id,work_id) do update set amount=excluded.amount;
 perform private.emit(org,d,'price.changed',x.version+1,jsonb_build_object('amount',old_price),jsonb_build_object('amount',nullif(payload->>'amount','')::bigint),payload->>'reason','commercial');
 end if;
 end if;
 elsif operation='comment.add' then
 insert into public.deal_comments(organization_id,deal_id,actor_id,body) values(org,d,m,payload->>'body');
 else raise exception 'UNKNOWN_OPERATION';end if;
 update public.deals set version=version+1 where id=d;
 end if;
 perform private.validate_deal(org,d);
 select * into x from public.deals where id=d;
 perform private.sync_charge(org,d,payload->>'reason',coalesce((payload->>'reconcile')::boolean,false));
 if x.pipeline='sales' and x.first_confirmed_at is not null then
 insert into public.portfolio_items(organization_id,deal_id,status) values(org,d,case x.stage when 'delivered' then 'completed' when 'lost' then 'archived' else 'draft' end)
 on conflict(organization_id,deal_id) do update set status=excluded.status;end if;
 perform private.emit(org,d,operation,x.version,null,jsonb_build_object('stage',x.stage,'version',x.version,'open_work_ids',x.open_work_snapshot),payload->>'reason');
 result:=jsonb_build_object('id',d,'version',x.version,'work_id',w);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;
create function public.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.crm_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.crm_command(uuid,text,jsonb,bigint,uuid),public.crm_command(uuid,text,jsonb,bigint,uuid) to authenticated;
