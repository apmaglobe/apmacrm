create table public.service_contracts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,customer_id uuid not null,source_deal_id uuid,
 title text not null,category text not null default 'monthly_service',billing_day int not null check(billing_day between 1 and 31),
 first_payment_date date not null,end_date date,proration_policy text not null default 'none' check(proration_policy='none'),
 status text not null default 'active' check(status in('active','paused','stopped')),service_last_day date,
 next_period_start date not null,version bigint not null default 1,created_at timestamptz not null default now(),unique(organization_id,id),
 foreign key(organization_id,customer_id) references public.customers(organization_id,id),foreign key(organization_id,source_deal_id) references public.deals(organization_id,id)
);
create table public.contract_revisions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,contract_id uuid not null,version bigint not null,
 effective_at timestamptz not null,settings jsonb not null,reason text,unique(organization_id,id),unique(organization_id,contract_id,version),
 foreign key(organization_id,contract_id) references public.service_contracts(organization_id,id)
);
create table public.contract_periods (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,contract_id uuid not null,revision_id uuid not null,
 period_start date not null,period_end date not null,deal_id uuid,template_snapshot jsonb not null,
 status text not null default 'queued' check(status in('queued','ready','failed')),last_error text,attempts int not null default 0,
 unique(organization_id,id),unique(organization_id,contract_id,period_start),unique(organization_id,deal_id),check(period_end>period_start),
 foreign key(organization_id,contract_id) references public.service_contracts(organization_id,id),foreign key(organization_id,revision_id) references public.contract_revisions(organization_id,id),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id)
);
-- Revision/template prices only visible to admins; ordinary cards expose a derived alert, not amounts.
do $$declare t text;begin foreach t in array array['service_contracts','contract_revisions','contract_periods'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 execute format('create policy contract_admin on public.%I for select to authenticated using(private.is_admin(organization_id))',t);end loop;end$$;
create function private.billing_date(anchor date,day int,months int default 1) returns date language sql immutable set search_path='' as $$
 select (date_trunc('month',anchor)+make_interval(months=>months))::date + least(day,extract(day from date_trunc('month',anchor)+make_interval(months=>months+1)-interval '1 day')::int)-1;
$$;
create function private.generate_period(org uuid,contract uuid) returns uuid language plpgsql set search_path='' as $$
declare c public.service_contracts;rev public.contract_revisions;p public.contract_periods;item jsonb;d uuid;w uuid;m uuid;num bigint;yr int;boundary timestamptz;due timestamptz;begin
 select * into c from public.service_contracts where organization_id=org and id=contract for update;
 if c.status<>'active' or c.next_period_start>(now() at time zone 'Asia/Baku')::date or c.end_date is not null and c.next_period_start>c.end_date then return null;end if;
 select * into rev from public.contract_revisions where organization_id=org and contract_id=c.id and effective_at<=(c.next_period_start::timestamp at time zone 'Asia/Baku') order by version desc limit 1;
 if rev.id is null then select * into rev from public.contract_revisions where organization_id=org and contract_id=c.id order by version limit 1;end if;
 insert into public.contract_periods(organization_id,contract_id,revision_id,period_start,period_end,template_snapshot)
 values(org,c.id,rev.id,c.next_period_start,private.billing_date(c.next_period_start,c.billing_day),rev.settings)
 on conflict(organization_id,contract_id,period_start) do nothing;
 select * into p from public.contract_periods where organization_id=org and contract_id=c.id and period_start=c.next_period_start for update;
 if p.status='ready' then update public.service_contracts set next_period_start=p.period_end where id=c.id;return p.deal_id;end if;
 begin
 m:=(p.template_snapshot->>'accountable_id')::uuid;
 if not exists(select 1 from public.memberships where organization_id=org and id=m and status='active') then raise exception 'INACTIVE_ACCOUNTABLE';end if;
 if jsonb_array_length(coalesce(p.template_snapshot->'works','[]'))=0 then raise exception 'TEMPLATE_WORK_REQUIRED';end if;
 boundary:=p.period_end::timestamp at time zone 'Asia/Baku'-interval '1 minute';
 yr:=extract(year from p.period_start);
 insert into private.serials values(org,yr,1) on conflict(organization_id,year) do update set value=private.serials.value+1 returning value into num;
 insert into public.deals(organization_id,serial,title,customer_id,accountable_id,creation_source,pipeline,stage,due_at,first_confirmed_at,zero_reason)
 values(org,'CRM-'||yr||'-'||lpad(num::text,6,'0'),c.title||' · '||to_char(p.period_start,'MM.YYYY'),c.customer_id,m,'recurring','recurring','recurring_todo',boundary,now(),p.template_snapshot->>'zero_reason') returning id into d;
 for item in select * from jsonb_array_elements(p.template_snapshot->'works') loop
 due:=case when item->>'due_offset_days' is null then boundary else ((p.period_start+(item->>'due_offset_days')::int)::text||' '||coalesce(item->>'due_time','18:00'))::timestamp at time zone 'Asia/Baku' end;
 insert into public.work_items(organization_id,deal_id,kind,name,department_id,assignee_id,due_at,billing_interval)
 values(org,d,coalesce(item->>'kind','service'),item->>'name',(item->>'department_id')::uuid,(item->>'assignee_id')::uuid,due,'monthly') returning id into w;
 if coalesce(item->>'kind','service')='service' then insert into public.work_prices values(org,w,(item->>'amount')::bigint);end if;
 end loop;
 perform private.validate_deal(org,d);perform private.sync_charge(org,d,null);
 update public.financial_documents set source_key='period:'||p.id||':charge' where organization_id=org and deal_id=d and kind='charge';
 update public.contract_periods set status='ready',deal_id=d,last_error=null,attempts=attempts+1 where id=p.id;
 update public.service_contracts set next_period_start=p.period_end where id=c.id;
 perform private.emit(org,d,'period.generated',1);return d;
 exception when others then update public.contract_periods set status='failed',last_error=sqlerrm,attempts=attempts+1 where id=p.id;return null;end;
end;$$;
create function private.subscription_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.service_contracts;rid uuid;prior private.requests;result jsonb;settings jsonb;nextday date;d uuid;begin
 perform private.require_admin(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=subscription_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select * into c from public.service_contracts where organization_id=org and id=rid for update;
 if c.id is not null and c.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation='contract.save' then
 if c.id is not null and nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 -- Drain already-started periods using the old revision before changing future terms.
 if c.id is not null then perform private.generate_period(org,c.id);end if;
 insert into public.service_contracts(id,organization_id,customer_id,source_deal_id,title,category,billing_day,first_payment_date,end_date,next_period_start)
 values(rid,org,(payload->>'customer_id')::uuid,nullif(payload->>'source_deal_id','')::uuid,payload->>'title',coalesce(payload->>'category','monthly_service'),(payload->>'billing_day')::int,(payload->>'first_payment_date')::date,nullif(payload->>'end_date','')::date,(payload->>'first_payment_date')::date)
 on conflict(id) do update set title=excluded.title,end_date=excluded.end_date,version=service_contracts.version+1 where service_contracts.organization_id=org returning * into c;
 settings:=jsonb_build_object('works',payload->'works','accountable_id',payload->>'accountable_id','zero_reason',payload->>'zero_reason');
 insert into public.contract_revisions(organization_id,contract_id,version,effective_at,settings,reason) values(org,rid,c.version,case when c.version=1 then c.first_payment_date::timestamp at time zone 'Asia/Baku' else now() end,settings,payload->>'reason');
 elsif operation in('contract.pause','contract.stop','contract.resume') then
 if c.id is null then raise exception 'NOT_FOUND';end if;if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 perform private.generate_period(org,c.id);
 nextday:=private.billing_date((now() at time zone 'Asia/Baku')::date,c.billing_day,0);
 if nextday<=(now() at time zone 'Asia/Baku')::date then nextday:=private.billing_date(nextday,c.billing_day);end if;
 update public.service_contracts set status=case operation when 'contract.resume' then 'active' when 'contract.pause' then 'paused' else 'stopped' end,
 service_last_day=case when operation='contract.resume' then service_last_day else coalesce(nullif(payload->>'service_last_day','')::date,(now() at time zone 'Asia/Baku')::date) end,
 next_period_start=case when operation='contract.resume' then nextday else next_period_start end,version=version+1 where id=rid;
 elsif operation='contract.generate' then if c.id is null then raise exception 'NOT_FOUND';end if;d:=private.generate_period(org,rid);
 else raise exception 'UNKNOWN_OPERATION';end if;
 result:=jsonb_build_object('id',rid,'deal_id',d);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data,reason) values(org,auth.uid(),operation,'admin',result,payload->>'reason');
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'subscriptions',rid);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;
create function public.subscription_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.subscription_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.subscription_command(uuid,text,jsonb,bigint,uuid),public.subscription_command(uuid,text,jsonb,bigint,uuid) to authenticated;
create function private.display_stage(org uuid,d uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare x public.deals;p public.contract_periods;c bigint;paid bigint;begin
 if not private.can_read_deal(org,d) then return null;end if;select * into x from public.deals where organization_id=org and id=d;
 if x.pipeline='sales' then return x.stage;end if;
 select * into p from public.contract_periods where organization_id=org and deal_id=d;
 c:=private.charge(org,d);paid:=private.paid(org,d);
 if c>0 and 2*paid<c and (now() at time zone 'Asia/Baku')::date>p.period_start then return 'recurring_unpaid';end if;return x.stage;
end;$$;
grant execute on function private.display_stage(uuid,uuid) to authenticated;
create view public.deal_cards with(security_invoker=true) as select d.*,private.display_stage(d.organization_id,d.id) display_stage,public.price_summary(d.organization_id,d.id) commercial from public.deals d;
grant select on public.deal_cards to authenticated;
