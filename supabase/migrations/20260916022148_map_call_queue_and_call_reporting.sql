-- Map müəssisələri üçün paylaşılan satış zəng növbəsi və zəng tarixçəsi.
-- Növbə qutusu yalnız ilk zəngi edən əməkdaş tərəfindən sahiblənilir.

alter table public.deals drop constraint if exists deals_creation_source_check;
alter table public.deals add constraint deals_creation_source_check
  check(creation_source in('manual','webhook','recurring','map_intake'));
alter table public.deals drop constraint if exists deals_check;
alter table public.deals add constraint deals_creator_source_check
  check((creation_source='manual')=(created_by is not null));
create index if not exists deals_map_call_queue
  on public.deals(organization_id,created_at desc,id desc)
  where not archived and creation_source='map_intake' and pipeline='sales' and stage='to_call';

create table public.sales_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations,
  deal_id uuid not null,
  customer_id uuid not null,
  caller_id uuid not null,
  phone text,
  outcome text not null check(outcome in('called','meaningless')),
  note text,
  created_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,deal_id) references public.deals(organization_id,id),
  foreign key(organization_id,customer_id) references public.customers(organization_id,id),
  foreign key(organization_id,caller_id) references public.memberships(organization_id,id)
);
create index sales_calls_reporting on public.sales_calls(organization_id,caller_id,created_at desc);
create index sales_calls_deal on public.sales_calls(organization_id,deal_id,created_at desc);
alter table public.sales_calls enable row level security;
revoke all on public.sales_calls from anon,authenticated;
grant select on public.sales_calls to authenticated;
create policy sales_calls_read on public.sales_calls for select to authenticated using(
  private.is_admin(organization_id)
  or caller_id=private.member_id(organization_id)
  or private.can_read_deal(organization_id,deal_id)
);

-- The call queue is visible to active members only while it is unclaimed.
create or replace function private.can_read_deal(org uuid, d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and (
   private.is_admin(org) or private.participates(org,d)
   or exists(select 1 from public.work_items w join public.department_members dm on dm.organization_id=w.organization_id and dm.department_id=w.department_id
     where w.organization_id=org and w.deal_id=d and not w.archived and dm.member_id=private.member_id(org))
   or exists(select 1 from public.deals x join public.department_members dm on dm.organization_id=x.organization_id and dm.department_id=x.intake_department_id
     where x.organization_id=org and x.id=d and dm.member_id=private.member_id(org))
   or exists(select 1 from public.deals x where x.organization_id=org and x.id=d and not x.archived
     and x.creation_source='map_intake' and x.pipeline='sales' and x.stage='to_call')
 );
$$;

-- Board query follows the same queue visibility rule as the direct RLS policy.
create or replace function private.board_filtered(org uuid,which_pipeline text,search text,filters jsonb,cursors jsonb,skip_pages int default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m uuid;admin boolean;result jsonb;begin
 m:=private.require_member(org);admin:=private.is_admin(org);
 if which_pipeline not in('sales','recurring') then raise exception 'INVALID_PIPELINE';end if;
 execute 'with departments as materialized(select department_id from public.department_members where organization_id=$1 and member_id=$2),
 assigned as materialized(select deal_id id from public.deal_members where organization_id=$1 and member_id=$2 union select deal_id from public.work_items where organization_id=$1 and not archived and (assignee_id=$2 or department_id in(select department_id from departments))),
 visible as materialized(select d.id,d.stage,d.created_at,case when d.pipeline=''sales'' then d.stage else private.display_stage($1,d.id) end display_stage from public.deals d
 where d.organization_id=$1 and d.pipeline=$3 and ($4 or $2 in(d.created_by,d.accountable_id,d.mediator_id) or d.id in(select id from assigned) or d.intake_department_id in(select department_id from departments) or (d.creation_source=''map_intake'' and d.stage=''to_call''))
 and ($5='''' or strpos(lower(coalesce(d.title,d.serial)),lower($5))>0)'||private.deal_filter_sql(filters)||'),
 eligible as(select v.*,row_number() over(partition by display_stage order by created_at desc,id desc) rn from visible v where not($6 ? display_stage) or $6->display_stage<>''null''::jsonb and (v.created_at,v.id)<(($6->display_stage->>''time'')::timestamptz,($6->display_stage->>''id'')::uuid)),
 page as materialized(select * from eligible where rn>$7*30 and rn<=($7+1)*30), counts as(select display_stage,count(*) n from visible group by display_stage), remaining as(select display_stage,max(rn) n from eligible group by display_stage), tail as(select distinct on(display_stage) display_stage,created_at,id from page order by display_stage,created_at,id)
 select jsonb_build_object(''rows'',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object(''display_stage'',p.display_stage,''commercial'',public.price_summary($1,d.id)) order by d.created_at desc,d.id desc),''[]'') from page p join public.deals d on d.organization_id=$1 and d.id=p.id),''counts'',(select coalesce(jsonb_object_agg(display_stage,n),''{}'') from counts),''next'',(select coalesce(jsonb_object_agg(c.display_stage,case when r.n>($7+1)*30 then jsonb_build_object(''time'',t.created_at,''id'',t.id) else ''null''::jsonb end),''{}'') from counts c left join remaining r using(display_stage) left join tail t using(display_stage)))'
 into result using org,m,which_pipeline,admin,left(coalesce(search,''),120),coalesce(cursors,'{}'),greatest(skip_pages,0);
 return result;
end;$$;

-- Create one call-queue box for every mapped enterprise that has no active sales box.
create or replace function private.seed_map_call_queue(org uuid) returns integer language plpgsql security definer set search_path='' as $$
declare added integer:=0; yr integer:=extract(year from now() at time zone 'Asia/Baku'); last_serial bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 with candidates as materialized (
   select c.id,c.name,row_number() over(order by c.created_at,c.id) rn
   from public.customers c
   where c.organization_id=org and not c.archived
     and exists(select 1 from public.customer_locations l where l.organization_id=org and l.customer_id=c.id and not l.archived)
     and not exists(select 1 from public.deals d where d.organization_id=org and d.customer_id=c.id and d.pipeline='sales' and not d.archived)
 ), counted as (select count(*) n from candidates), serial_counter as (
   insert into private.serials(organization_id,year,value)
   select org,yr,n from counted where n>0
   on conflict(organization_id,year) do update set value=private.serials.value+excluded.value
   returning value
 )
 select coalesce((select value from serial_counter),0),coalesce((select n from counted),0) into last_serial,added;
 if added=0 then return 0; end if;
 insert into public.deals(organization_id,serial,title,customer_id,creation_source,pipeline,stage)
 select org,'CRM-'||yr||'-'||lpad((last_serial-added+rn)::text,6,'0'),name,id,'map_intake','sales','to_call'
 from (
   select c.id,c.name,row_number() over(order by c.created_at,c.id) rn
   from public.customers c where c.organization_id=org and not c.archived
     and exists(select 1 from public.customer_locations l where l.organization_id=org and l.customer_id=c.id and not l.archived)
     and not exists(select 1 from public.deals d where d.organization_id=org and d.customer_id=c.id and d.pipeline='sales' and not d.archived)
 ) x;
 return added;
end;$$;

do $$ declare tenant uuid; begin
 for tenant in select distinct c.organization_id from public.customers c where not c.archived and exists(select 1 from public.customer_locations l where l.organization_id=c.organization_id and l.customer_id=c.id and not l.archived) loop
   perform private.seed_map_call_queue(tenant);
 end loop;
end $$;

-- Keep existing CRM commands untouched; intercept only call queue operations.
alter function private.crm_command(uuid,text,jsonb,bigint,uuid) rename to crm_command_call_base;
create function private.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid; prior private.requests; x public.deals; result jsonb; reason_id uuid; clean_note text; clean_phone text; new_version bigint;
begin
 if operation not in('call.record','call.meaningless') then
   return private.crm_command_call_base(org,operation,payload,expected_version,request_id);
 end if;
 m:=private.require_member(org);
 if request_id is null or jsonb_typeof(payload)<>'object' then raise exception 'INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=crm_command.request_id;
 if found then
   if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return prior.result;
 end if;
 select * into x from public.deals where organization_id=org and id=nullif(payload->>'deal_id','')::uuid for update;
 if x.id is null or x.archived or x.pipeline<>'sales' or x.stage<>'to_call' then raise exception 'CALL_QUEUE_UNAVAILABLE' using errcode='42501'; end if;
 if x.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001'; end if;
 if not(private.can_read_deal(org,x.id)) then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 clean_note:=nullif(left(btrim(coalesce(payload->>'note','')),2000),'');
 clean_phone:=nullif(left(btrim(coalesce(payload->>'phone','')),80),'');
 if operation='call.record' and clean_phone is null then raise exception 'CALL_PHONE_REQUIRED'; end if;
 if operation='call.record' then
   update public.deals set stage='called',accountable_id=coalesce(accountable_id,m),version=version+1 where organization_id=org and id=x.id returning version into new_version;
   insert into public.sales_calls(organization_id,deal_id,customer_id,caller_id,phone,outcome,note) values(org,x.id,x.customer_id,m,clean_phone,'called',clean_note);
   perform private.emit(org,x.id,'call.recorded',new_version,jsonb_build_object('stage',x.stage),jsonb_build_object('stage','called','caller_id',m,'phone',clean_phone),clean_note);
 else
   select id into reason_id from public.loss_reasons where organization_id=org and lower(name)=lower('Mənasız müəssisə') and not archived order by id limit 1;
   if reason_id is null then
     insert into public.loss_reasons(organization_id,name) values(org,'Mənasız müəssisə') returning id into reason_id;
   end if;
   update public.deals set stage='lost',loss_reason_id=reason_id,accountable_id=coalesce(accountable_id,m),version=version+1 where organization_id=org and id=x.id returning version into new_version;
   insert into public.sales_calls(organization_id,deal_id,customer_id,caller_id,phone,outcome,note) values(org,x.id,x.customer_id,m,clean_phone,'meaningless',clean_note);
   perform private.emit(org,x.id,'call.marked_meaningless',new_version,jsonb_build_object('stage',x.stage),jsonb_build_object('stage','lost','caller_id',m),clean_note);
 end if;
 result:=jsonb_build_object('id',x.id,'version',new_version,'phone',clean_phone,'outcome',case when operation='call.record' then 'called' else 'meaningless' end);
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 return result;
end;$$;
create or replace function public.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.crm_command(org,operation,payload,expected_version,request_id);$$;
revoke all on function private.crm_command_call_base(uuid,text,jsonb,bigint,uuid) from public,anon,authenticated;
revoke all on function private.crm_command(uuid,text,jsonb,bigint,uuid),public.crm_command(uuid,text,jsonb,bigint,uuid) from public,anon;
grant execute on function private.crm_command(uuid,text,jsonb,bigint,uuid),public.crm_command(uuid,text,jsonb,bigint,uuid) to authenticated;
