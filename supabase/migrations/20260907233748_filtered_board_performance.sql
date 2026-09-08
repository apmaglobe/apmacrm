-- Compile only known filter fields with literal quoting; same predicate is shared by board and exports.
create function private.deal_filter_sql(filters jsonb) returns text language plpgsql immutable set search_path='' as $$declare clause text:='';begin
 clause:=' and d.archived='||case when filters->>'archived'='true' then 'true' else 'false' end;
 if nullif(filters->>'department_id','') is not null then clause:=clause||format(' and (d.intake_department_id=%L::uuid or exists(select 1 from public.work_items fw where fw.organization_id=d.organization_id and fw.deal_id=d.id and not fw.archived and fw.department_id=%L::uuid))',filters->>'department_id',filters->>'department_id');end if;
 if nullif(filters->>'accountable_id','') is not null then clause:=clause||format(' and d.accountable_id=%L::uuid',filters->>'accountable_id');end if;
 if nullif(filters->>'customer_id','') is not null then clause:=clause||format(' and d.customer_id=%L::uuid',filters->>'customer_id');end if;
 if nullif(filters->>'participant_id','') is not null then clause:=clause||format(' and (%L::uuid in(d.created_by,d.accountable_id) or exists(select 1 from public.deal_members fm where fm.organization_id=d.organization_id and fm.deal_id=d.id and fm.member_id=%L::uuid) or exists(select 1 from public.work_items fw where fw.organization_id=d.organization_id and fw.deal_id=d.id and not fw.archived and fw.assignee_id=%L::uuid))',filters->>'participant_id',filters->>'participant_id',filters->>'participant_id');end if;
 if nullif(filters->>'due_from','') is not null then clause:=clause||format(' and d.due_at>=(%L::date::timestamp at time zone ''Asia/Baku'')',filters->>'due_from');end if;
 if nullif(filters->>'due_to','') is not null then clause:=clause||format(' and d.due_at<((%L::date+1)::timestamp at time zone ''Asia/Baku'')',filters->>'due_to');end if;
 if filters->>'overdue'='true' then clause:=clause||' and d.due_at<now() and d.stage not in(''delivered'',''lost'',''recurring_done'')';end if;
 if nullif(filters->>'stage','') is not null then clause:=clause||format(' and (case when d.pipeline=''sales'' then d.stage else private.display_stage(d.organization_id,d.id) end)=%L',filters->>'stage');end if;
 return clause;
end;$$;
create function private.board_filtered(org uuid,which_pipeline text,search text,filters jsonb,cursors jsonb,skip_pages int default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m uuid;admin boolean;result jsonb;begin
 m:=private.require_member(org);admin:=private.is_admin(org);
 if which_pipeline not in('sales','recurring') then raise exception 'INVALID_PIPELINE';end if;
 execute 'with departments as materialized(select department_id from public.department_members where organization_id=$1 and member_id=$2),
 assigned as materialized(select deal_id id from public.deal_members where organization_id=$1 and member_id=$2 union select deal_id from public.work_items where organization_id=$1 and not archived and (assignee_id=$2 or department_id in(select department_id from departments))),
 visible as materialized(select d.id,d.stage,d.created_at,case when d.pipeline=''sales'' then d.stage else private.display_stage($1,d.id) end display_stage from public.deals d
 where d.organization_id=$1 and d.pipeline=$3 and ($4 or $2 in(d.created_by,d.accountable_id) or d.id in(select id from assigned) or d.intake_department_id in(select department_id from departments))
 and ($5='''' or strpos(lower(coalesce(d.title,d.serial)),lower($5))>0)'||private.deal_filter_sql(filters)||'),
 eligible as(select v.*,row_number() over(partition by display_stage order by created_at desc,id desc) rn from visible v where not($6 ? display_stage) or $6->display_stage<>''null''::jsonb and (v.created_at,v.id)<(($6->display_stage->>''time'')::timestamptz,($6->display_stage->>''id'')::uuid)),
 page as materialized(select * from eligible where rn>$7*30 and rn<=($7+1)*30),
 counts as(select display_stage,count(*) n from visible group by display_stage),
 remaining as(select display_stage,max(rn) n from eligible group by display_stage),
 tail as(select distinct on(display_stage) display_stage,created_at,id from page order by display_stage,created_at,id)
 select jsonb_build_object(''rows'',(select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object(''display_stage'',p.display_stage,''commercial'',public.price_summary($1,d.id)) order by d.created_at desc,d.id desc),''[]'') from page p join public.deals d on d.organization_id=$1 and d.id=p.id),
 ''counts'',(select coalesce(jsonb_object_agg(display_stage,n),''{}'') from counts),
 ''next'',(select coalesce(jsonb_object_agg(c.display_stage,case when r.n>($7+1)*30 then jsonb_build_object(''time'',t.created_at,''id'',t.id) else ''null''::jsonb end),''{}'') from counts c left join remaining r using(display_stage) left join tail t using(display_stage)))'
 into result using org,m,which_pipeline,admin,left(coalesce(search,''),120),coalesce(cursors,'{}'),greatest(skip_pages,0);
 return result;
end;$$;
create function public.board_filtered(org uuid,which_pipeline text,search text,filters jsonb,cursors jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.board_filtered(org,which_pipeline,search,filters,cursors);$$;
create or replace function public.board_page(org uuid,which_pipeline text default 'sales',search text default '',page_number int default 0) returns jsonb language sql stable security invoker set search_path='' as $$select private.board_filtered(org,which_pipeline,search,'{}','{}',page_number);$$;
revoke all on function private.deal_filter_sql(jsonb),private.board_filtered(uuid,text,text,jsonb,jsonb,int),public.board_filtered(uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.board_filtered(uuid,text,text,jsonb,jsonb,int),public.board_filtered(uuid,text,text,jsonb,jsonb) to authenticated;

create or replace function private.export_snapshot(org uuid,m text,filters jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text; result jsonb:='[]';rows jsonb;clause text;parent text;parent_key text;ids jsonb;search text:=left(coalesce(filters->>'q',''),120);begin
 perform private.export_access(org,m);
 foreach t in array private.export_tables(m) loop
 clause:=private.export_predicate(t);parent:=null;parent_key:=null;
 if t='work_items' and m='crm' then parent:='deal_cards';parent_key:='deal_id';
 elsif t='work_prices' then parent:='work_items';parent_key:='work_id';
 elsif t in('customer_locations','contacts') then parent:='customers';parent_key:='customer_id';end if;
 if parent is not null then
 select coalesce(jsonb_agg(row->>'id'),'[]') into ids from jsonb_array_elements(result) part cross join lateral jsonb_array_elements(part->'rows') row where part->>'table'=parent;
 clause:=clause||format(' and r.%I::text in(select jsonb_array_elements_text(%L::jsonb))',parent_key,ids::text);
 elsif search<>'' and t in('customers','deal_cards','work_items','tools','meetings','resource_links','memberships') then
 clause:=clause||format(' and strpos(lower(coalesce(r.%I,'''')),lower(%L))>0',case when t in('deal_cards','meetings','resource_links') then 'title' else 'name' end,search);
 end if;
 if t in('customers','work_items') then clause:=clause||' and not r.archived';end if;
 if t='deal_cards' then clause:=clause||replace(private.deal_filter_sql(filters),'d.','r.');end if;
 if t='deal_cards' and filters->>'pipeline' in('sales','recurring') then clause:=clause||format(' and r.pipeline=%L',filters->>'pipeline');end if;
 if m='todo' and coalesce(filters->>'scope','own')<>'shared' and not (private.is_admin(org) and filters->>'scope'='team') then clause:=clause||format(' and r.assignee_id=%L::uuid',private.member_id(org));end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)-array[''user_id'',''overrides'',''join_token'',''template_snapshot'',''intake''] order by r.%I),''[]'') from public.%I r where r.organization_id=$1 and (%s)',case when t='work_prices' then 'work_id' else 'id' end,t,clause) into rows using org;
 -- The definer context must not make view-derived price columns bypass field permission.
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
 select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 result:=result||jsonb_build_array(jsonb_build_object('table',t,'rows',rows));
 end loop;return result;
end;$$;
