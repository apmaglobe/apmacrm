-- A mediator is the sales coordinator for a box.  It gives read/history and
-- shared-To-Do access, but deliberately does not confer edit or finance rights.
alter table public.deals add column mediator_id uuid;
alter table public.deals add constraint deals_organization_id_mediator_id_fkey
  foreign key(organization_id,mediator_id) references public.memberships(organization_id,id);
create index deals_mediator on public.deals(organization_id,mediator_id) where mediator_id is not null and not archived;

create or replace function private.participates(org uuid,d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.member_id(org) is not null and (
 exists(select 1 from public.deals where organization_id=org and id=d and private.member_id(org) in(created_by,accountable_id,mediator_id))
 or exists(select 1 from public.deal_members where organization_id=org and deal_id=d and member_id=private.member_id(org))
 or exists(select 1 from public.work_items where organization_id=org and deal_id=d and assignee_id=private.member_id(org) and not archived));
$$;

create or replace function private.deal_filter_sql(filters jsonb) returns text language plpgsql immutable set search_path='' as $$declare clause text:='';begin
 clause:=' and d.archived='||case when filters->>'archived'='true' then 'true' else 'false' end;
 if nullif(filters->>'department_id','') is not null then clause:=clause||format(' and (d.intake_department_id=%L::uuid or exists(select 1 from public.work_items fw where fw.organization_id=d.organization_id and fw.deal_id=d.id and not fw.archived and fw.department_id=%L::uuid))',filters->>'department_id',filters->>'department_id');end if;
 if nullif(filters->>'accountable_id','') is not null then clause:=clause||format(' and d.accountable_id=%L::uuid',filters->>'accountable_id');end if;
 if nullif(filters->>'customer_id','') is not null then clause:=clause||format(' and d.customer_id=%L::uuid',filters->>'customer_id');end if;
 if nullif(filters->>'participant_id','') is not null then clause:=clause||format(' and (%L::uuid in(d.created_by,d.accountable_id,d.mediator_id) or exists(select 1 from public.deal_members fm where fm.organization_id=d.organization_id and fm.deal_id=d.id and fm.member_id=%L::uuid) or exists(select 1 from public.work_items fw where fw.organization_id=d.organization_id and fw.deal_id=d.id and not fw.archived and fw.assignee_id=%L::uuid))',filters->>'participant_id',filters->>'participant_id',filters->>'participant_id');end if;
 if nullif(filters->>'due_from','') is not null then clause:=clause||format(' and d.due_at>=(%L::date::timestamp at time zone ''Asia/Baku'')',filters->>'due_from');end if;
 if nullif(filters->>'due_to','') is not null then clause:=clause||format(' and d.due_at<((%L::date+1)::timestamp at time zone ''Asia/Baku'')',filters->>'due_to');end if;
 if filters->>'overdue'='true' then clause:=clause||' and d.due_at<now() and d.stage not in(''delivered'',''lost'',''recurring_done'')';end if;
 if nullif(filters->>'stage','') is not null then clause:=clause||format(' and (case when d.pipeline=''sales'' then d.stage else private.display_stage(d.organization_id,d.id) end)=%L',filters->>'stage');end if;
 return clause;
end;$$;

create or replace function private.board_filtered(org uuid,which_pipeline text,search text,filters jsonb,cursors jsonb,skip_pages int default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m uuid;admin boolean;result jsonb;begin
 m:=private.require_member(org);admin:=private.is_admin(org);
 if which_pipeline not in('sales','recurring') then raise exception 'INVALID_PIPELINE';end if;
 execute 'with departments as materialized(select department_id from public.department_members where organization_id=$1 and member_id=$2),
 assigned as materialized(select deal_id id from public.deal_members where organization_id=$1 and member_id=$2 union select deal_id from public.work_items where organization_id=$1 and not archived and (assignee_id=$2 or department_id in(select department_id from departments))),
 visible as materialized(select d.id,d.stage,d.created_at,case when d.pipeline=''sales'' then d.stage else private.display_stage($1,d.id) end display_stage from public.deals d
 where d.organization_id=$1 and d.pipeline=$3 and ($4 or $2 in(d.created_by,d.accountable_id,d.mediator_id) or d.id in(select id from assigned) or d.intake_department_id in(select department_id from departments))
 and ($5='''' or strpos(lower(coalesce(d.title,d.serial)),lower($5))>0)'||private.deal_filter_sql(filters)||'),
 eligible as(select v.*,row_number() over(partition by display_stage order by created_at desc,id desc) rn from visible v where not($6 ? display_stage) or $6->display_stage<>''null''::jsonb and (v.created_at,v.id)<(($6->display_stage->>''time'')::timestamptz,($6->display_stage->>''id'')::uuid)),
 page as materialized(select * from eligible where rn>$7*30 and rn<=($7+1)*30), counts as(select display_stage,count(*) n from visible group by display_stage), remaining as(select display_stage,max(rn) n from eligible group by display_stage), tail as(select distinct on(display_stage) display_stage,created_at,id from page order by display_stage,created_at,id)
 select jsonb_build_object(''rows'',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object(''display_stage'',p.display_stage,''commercial'',public.price_summary($1,d.id)) order by d.created_at desc,d.id desc),''[]'') from page p join public.deals d on d.organization_id=$1 and d.id=p.id),''counts'',(select coalesce(jsonb_object_agg(display_stage,n),''{}'') from counts),''next'',(select coalesce(jsonb_object_agg(c.display_stage,case when r.n>($7+1)*30 then jsonb_build_object(''time'',t.created_at,''id'',t.id) else ''null''::jsonb end),''{}'') from counts c left join remaining r using(display_stage) left join tail t using(display_stage)))'
 into result using org,m,which_pipeline,admin,left(coalesce(search,''),120),coalesce(cursors,'{}'),greatest(skip_pages,0);
 return result;
end;$$;

create or replace function private.todo_items(org uuid,scope text,search text,skip_rows int) returns setof public.work_items language plpgsql stable security definer set search_path='' as $$
declare m uuid:=private.require_member(org);admin boolean:=private.is_admin(org);begin
 if scope not in('mine','own','shared','team') or scope='team' and not admin then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 return query with shared as materialized(
 select d.id from public.deals d where d.organization_id=org and m in(d.created_by,d.accountable_id,d.mediator_id)
 union select dm.deal_id from public.deal_members dm where dm.organization_id=org and dm.member_id=m
 union select w.deal_id from public.work_items w where w.organization_id=org and not w.archived and w.assignee_id=m
 ) select w.* from public.work_items w where w.organization_id=org and not w.archived and (scope='team' and admin or scope in('mine','own') and w.assignee_id=m or scope='shared' and w.deal_id in(select id from shared)) and strpos(lower(w.name),lower(left(coalesce(search,''),120)))>0 order by w.due_at asc nulls last,w.id offset greatest(skip_rows,0) limit 200;
end;$$;

-- Keep the owner-aware wrapper and add mediator validation, audit and optimistic versioning.
alter function private.crm_command(uuid,text,jsonb,bigint,uuid) rename to crm_command_owner_base;
create function private.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior private.requests; mediator uuid; clean_payload jsonb; result jsonb; deal_id uuid; version_after bigint;
begin
 if operation not in('deal.create','deal.update') or not (payload ? 'mediator_id') then
   return private.crm_command_owner_base(org,operation,payload,expected_version,request_id);
 end if;
 perform private.require_member(org); perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests r where r.organization_id=org and r.actor_id=auth.uid() and r.request_id=crm_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if; return prior.result; end if;
 mediator:=nullif(payload->>'mediator_id','')::uuid;
 if mediator is not null and not exists(select 1 from public.memberships where organization_id=org and id=mediator and status='active') then raise exception 'INACTIVE_ASSIGNEE'; end if;
 clean_payload:=payload-'mediator_id';
 result:=private.crm_command_owner_base(org,operation,clean_payload,expected_version,gen_random_uuid());
 deal_id:=case when operation='deal.create' then (result->>'id')::uuid else (payload->>'deal_id')::uuid end;
 update public.deals set mediator_id=mediator,version=version+1 where organization_id=org and id=deal_id returning version into version_after;
 result:=jsonb_set(result,'{version}',to_jsonb(version_after));
 perform private.emit(org,deal_id,'deal.mediator_assigned',version_after,null,jsonb_build_object('mediator_id',mediator));
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);
 return result;
end;$$;
create or replace function public.crm_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.crm_command(org,operation,payload,expected_version,request_id);$$;
revoke all on function private.crm_command_owner_base(uuid,text,jsonb,bigint,uuid) from public,anon,authenticated;
revoke all on function private.crm_command(uuid,text,jsonb,bigint,uuid),public.crm_command(uuid,text,jsonb,bigint,uuid) from public,anon;
grant execute on function private.crm_command(uuid,text,jsonb,bigint,uuid),public.crm_command(uuid,text,jsonb,bigint,uuid) to authenticated;
