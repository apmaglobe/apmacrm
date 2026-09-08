-- Preserve UUID index lookup while revalidating each exported source against current permissions.
create or replace function private.download_export(org uuid,job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.export_jobs;artifact jsonb;part jsonb;rows jsonb;result jsonb:='[]';t text;key text;begin
 select * into j from public.export_jobs where id=job and organization_id=org and user_id=auth.uid();
 if j.id is null then raise exception 'EXPORT_DENIED' using errcode='42501';end if;
 perform private.export_access(org,j.module);
 if j.status<>'done' or j.expires_at<=now() then raise exception 'EXPORT_NOT_READY';end if;
 select data into artifact from private.export_artifacts where job_id=job;
 for part in select value from jsonb_array_elements(artifact) loop
 t:=part->>'table';key:=case when t='work_prices' then 'work_id' else 'id' end;
 -- Revalidate every source row at download, including object/dept/assignee revocations since the snapshot.
 execute format('select coalesce(jsonb_agg(e.value),''[]'') from jsonb_array_elements($2) e where exists(select 1 from public.%I r where r.organization_id=$1 and r.%I=(e.value->>%L)::uuid and (%s))',t,key,key,private.export_predicate(t)) into rows using org,part->'rows';
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
 select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 result:=result||jsonb_build_array(jsonb_build_object('table',t,'rows',rows));end loop;
 return jsonb_build_object('module',j.module,'format',j.format,'tables',result);
end;$$;
