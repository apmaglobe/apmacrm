create or replace function private.subscription_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.service_contracts;rid uuid;prior private.requests;result jsonb;settings jsonb;nextday date;d uuid;p public.contract_periods;rev uuid;old_snapshot jsonb;begin
 perform private.require_admin(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=subscription_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if operation='period.repair' then
 select * into p from public.contract_periods where organization_id=org and id=rid for update;
 if p.id is null or p.status<>'failed' or p.deal_id is not null then raise exception 'FAILED_PERIOD_REQUIRED';end if;
 if p.attempts<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 select * into c from public.service_contracts where organization_id=org and id=p.contract_id for update;
 if c.status<>'active' or c.next_period_start<>p.period_start then raise exception 'CURRENT_FAILED_PERIOD_REQUIRED';end if;
 old_snapshot:=p.template_snapshot;
 settings:=jsonb_build_object('works',payload->'works','accountable_id',payload->>'accountable_id','zero_reason',payload->>'zero_reason');
 update public.service_contracts set version=version+1 where id=c.id returning * into c;
 insert into public.contract_revisions(organization_id,contract_id,version,effective_at,settings,reason) values(org,c.id,c.version,now(),settings,payload->>'reason') returning id into rev;
 update public.contract_periods set revision_id=rev,template_snapshot=settings where id=p.id;
 d:=private.generate_period(org,c.id);
 if d is null then raise exception 'PERIOD_GENERATION_BLOCKED';end if;
 update public.job_runs set status='done',locked_until=null,last_error=null,result=jsonb_build_object('deal_id',d),run_after=now() where organization_id=org and type='recurring' and dedupe_key=c.id::text||':'||p.period_start::text;
 result:=jsonb_build_object('id',c.id,'deal_id',d,'period_id',p.id);
 insert into public.audit_events(organization_id,actor_id,action,visibility,before_data,after_data,reason) values(org,auth.uid(),operation,'admin',old_snapshot,jsonb_build_object('revision_id',rev,'period_id',p.id,'settings',settings),payload->>'reason');
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'subscriptions',c.id);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
 end if;

 select * into c from public.service_contracts where organization_id=org and id=rid for update;
 if c.id is not null and c.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation='contract.save' then
 if c.id is not null and nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 -- Drain already-started periods using the old revision before changing future terms.
 if c.id is not null then perform private.drain_periods(org,c.id);end if;
 insert into public.service_contracts(id,organization_id,customer_id,source_deal_id,title,category,billing_day,first_payment_date,end_date,next_period_start)
 values(rid,org,(payload->>'customer_id')::uuid,nullif(payload->>'source_deal_id','')::uuid,payload->>'title',coalesce(payload->>'category','monthly_service'),(payload->>'billing_day')::int,(payload->>'first_payment_date')::date,nullif(payload->>'end_date','')::date,(payload->>'first_payment_date')::date)
 on conflict(id) do update set title=excluded.title,end_date=excluded.end_date,version=service_contracts.version+1 where service_contracts.organization_id=org returning * into c;
 settings:=jsonb_build_object('works',payload->'works','accountable_id',payload->>'accountable_id','zero_reason',payload->>'zero_reason');
 insert into public.contract_revisions(organization_id,contract_id,version,effective_at,settings,reason) values(org,rid,c.version,case when c.version=1 then c.first_payment_date::timestamp at time zone 'Asia/Baku' else now() end,settings,payload->>'reason');
 elsif operation in('contract.pause','contract.stop','contract.resume') then
 if c.id is null then raise exception 'NOT_FOUND';end if;if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 if operation='contract.resume' and c.status='active' or operation<>'contract.resume' and c.status<>'active' then raise exception 'INVALID_CONTRACT_TRANSITION';end if;
 perform private.drain_periods(org,c.id);
 if operation<>'contract.resume' then
 if coalesce(nullif(payload->>'service_last_day','')::date,(now() at time zone 'Asia/Baku')::date)>(now() at time zone 'Asia/Baku')::date then raise exception 'FUTURE_STOP_DATE';end if;
 update public.contract_periods set service_last_day=coalesce(nullif(payload->>'service_last_day','')::date,(now() at time zone 'Asia/Baku')::date)
 where organization_id=org and contract_id=c.id and period_end>(now() at time zone 'Asia/Baku')::date;
 end if;
 nextday:=private.billing_date((now() at time zone 'Asia/Baku')::date,c.billing_day,0);
 if nextday<=(now() at time zone 'Asia/Baku')::date then nextday:=private.billing_date(nextday,c.billing_day);end if;
 update public.service_contracts set status=case operation when 'contract.resume' then 'active' when 'contract.pause' then 'paused' else 'stopped' end,
 service_last_day=case when operation='contract.resume' then null else coalesce(nullif(payload->>'service_last_day','')::date,(now() at time zone 'Asia/Baku')::date) end,
 next_period_start=case when operation='contract.resume' then nextday else next_period_start end,version=version+1 where id=rid;
 elsif operation='contract.generate' then if c.id is null then raise exception 'NOT_FOUND';end if;d:=private.generate_period(org,rid);
 else raise exception 'UNKNOWN_OPERATION';end if;
 result:=jsonb_build_object('id',rid,'deal_id',d);
 insert into public.audit_events(organization_id,actor_id,action,visibility,after_data,reason) values(org,auth.uid(),operation,'admin',result,payload->>'reason');
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,'subscriptions',rid);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;
