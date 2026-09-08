create function private.finance_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if p.id is null or p.reversed_payment_id is not null or exists(select 1 from public.payments where organization_id=org and reversed_payment_id=p.id) then raise exception 'INVALID_PAYMENT';end if;
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
 elsif operation='payment.refund' then
 perform private.require_admin(org);
 select * into p from public.payments where organization_id=org and id=(payload->>'payment_id')::uuid for update;
 if p.id is null or p.direction<>'in' or p.reversed_payment_id is not null or exists(select 1 from public.payments where organization_id=org and reversed_payment_id=p.id) then raise exception 'INVALID_PAYMENT';end if;
 if nullif(trim(payload->>'reason'),'') is null then raise exception 'REASON_REQUIRED';end if;
 select coalesce(sum(amount),0) into used from public.payment_allocations where organization_id=org and payment_id=p.id;
 -- Refund the unallocated balance; allocation release is explicit and audited beforehand.
 select used+coalesce(sum(amount),0) into used from public.payments where organization_id=org and note='refund:'||p.id;
 if (payload->>'amount')::bigint>p.amount-used then raise exception 'REFUND_EXCEEDS_AVAILABLE';end if;
 insert into public.payments(id,organization_id,customer_id,account_id,direction,amount,payment_date,note,reason,actor_id)
 values(rid,org,p.customer_id,p.account_id,'out',(payload->>'amount')::bigint,(payload->>'payment_date')::timestamptz,'refund:'||p.id,payload->>'reason',auth.uid());
 else raise exception 'UNKNOWN_OPERATION';end if;
 if pid is not null then
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
create function public.finance_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.finance_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.finance_command(uuid,text,jsonb,bigint,uuid),public.finance_command(uuid,text,jsonb,bigint,uuid) to authenticated;
