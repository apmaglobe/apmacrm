-- Slice the JSON array before expansion so each page avoids materializing every source row.
-- Current actor, tenant, object and commercial checks remain unchanged.
create or replace function private.export_page(org uuid,job uuid,part_index integer default 0,row_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.export_jobs;artifact jsonb;part jsonb;rows jsonb;t text;k text;next_offset integer;next_part integer;
begin
 select * into j from public.export_jobs where id=job and organization_id=org and user_id=auth.uid();
 if j.id is null then raise exception 'EXPORT_DENIED' using errcode='42501';end if;
 perform private.export_access(org,j.module);
 if j.status<>'done' or j.expires_at<=now() then raise exception 'EXPORT_NOT_READY';end if;
 if part_index is null or row_offset is null or part_index<0 or row_offset<0 or row_offset>1000000 then raise exception 'INVALID_EXPORT_PAGE';end if;
 select data into artifact from private.export_artifacts where job_id=job;
 if part_index>=jsonb_array_length(artifact) or (j.format='csv' and part_index<>0) then raise exception 'INVALID_EXPORT_PAGE';end if;
 part:=artifact->part_index;t:=part->>'table';k:=case when t='work_prices' then 'work_id' else 'id' end;
 execute format('select coalesce(jsonb_agg(e.value order by e.n),''[]'') from jsonb_array_elements($2) with ordinality as e(value,n) where exists(select 1 from public.%I r where r.organization_id=$1 and r.%I=(e.value->>%L)::uuid and (%s))',t,k,k,private.export_predicate(t)) into rows using org,jsonb_path_query_array(part->'rows',format('$[%s to %s]',row_offset,row_offset+499)::jsonpath);
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
  select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 if row_offset+500<jsonb_array_length(part->'rows') then next_offset:=row_offset+500;
 elsif j.format='xlsx' and part_index+1<jsonb_array_length(artifact) then next_part:=part_index+1;end if;
 return jsonb_build_object('module',j.module,'format',j.format,'table',t,'rows',rows,'next_offset',next_offset,'next_part',next_part);
end;$$;
