-- Quantity is descriptive: amount is the full line price, never multiplied implicitly.
alter table public.deal_comments add column mentions uuid[] not null default '{}';
create or replace function private.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; d uuid; w uuid; x public.deals; old_work public.work_items; item jsonb; prior private.requests; result jsonb; num bigint; yr int; amount_changed boolean:=false; open_ids uuid[]; old_price bigint;mentioned uuid;comment_id uuid;begin
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
 insert into public.work_items(organization_id,deal_id,name,department_id,assignee_id,catalog_id,due_at,billing_interval,quantity)
 values(org,d,item->>'name',(item->>'department_id')::uuid,coalesce(nullif(item->>'assignee_id','')::uuid,m),nullif(item->>'catalog_id','')::uuid,nullif(item->>'due_at','')::timestamptz,coalesce(item->>'billing_interval','once'),coalesce((item->>'quantity')::numeric,1)) returning id into w;
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
 location_id=case when payload ? 'location_id' then nullif(payload->>'location_id','')::uuid else location_id end,
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
 insert into public.work_items(id,organization_id,deal_id,kind,parent_service_id,catalog_id,name,description,department_id,assignee_id,due_at,billing_interval,quantity)
 values(w,org,d,coalesce(payload->>'kind','service'),nullif(payload->>'parent_service_id','')::uuid,nullif(payload->>'catalog_id','')::uuid,payload->>'name',payload->>'description',(payload->>'department_id')::uuid,nullif(payload->>'assignee_id','')::uuid,nullif(payload->>'due_at','')::timestamptz,coalesce(payload->>'billing_interval','once'),coalesce((payload->>'quantity')::numeric,1));
 else
 update public.work_items set quantity=coalesce((payload->>'quantity')::numeric,quantity),name=coalesce(payload->>'name',name),description=coalesce(payload->>'description',description),
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
 if jsonb_array_length(coalesce(payload->'mentions','[]'))>50 then raise exception 'MENTION_LIMIT';end if;
 for mentioned in select jsonb_array_elements_text(coalesce(payload->'mentions','[]'))::uuid loop
 if not exists(select 1 from public.memberships target join public.deals box on box.organization_id=target.organization_id and box.id=d
 where target.organization_id=org and target.id=mentioned and target.status='active' and (target.is_admin or target.id in(box.created_by,box.accountable_id)
 or exists(select 1 from public.deal_members dm where dm.organization_id=org and dm.deal_id=d and dm.member_id=target.id)
 or exists(select 1 from public.work_items w where w.organization_id=org and w.deal_id=d and not w.archived and (w.assignee_id=target.id or exists(select 1 from public.department_members dm where dm.organization_id=org and dm.member_id=target.id and dm.department_id=w.department_id)))
 or exists(select 1 from public.department_members dm where dm.organization_id=org and dm.member_id=target.id and dm.department_id=box.intake_department_id))) then raise exception 'MENTION_ACCESS_DENIED' using errcode='42501';end if;
 end loop;
 insert into public.deal_comments(organization_id,deal_id,actor_id,body,mentions) values(org,d,m,payload->>'body',array(select jsonb_array_elements_text(coalesce(payload->'mentions','[]'))::uuid)) returning id into comment_id;
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
 if operation='comment.add' then
 insert into public.notifications(organization_id,recipient_id,deal_id,event_key,label)
 select distinct org,target,d,d::text||':'||x.version::text||':comment.add','Rəydə adınız qeyd edilib'
 from unnest(array(select jsonb_array_elements_text(coalesce(payload->'mentions','[]'))::uuid)) target where target<>m
 on conflict(organization_id,recipient_id,event_key) do update set label=excluded.label;
 end if;
 result:=jsonb_build_object('id',d,'version',x.version,'work_id',w);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;
