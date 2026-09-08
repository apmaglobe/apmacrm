-- Persist bounded private chunks once, so downloads do not decompress the entire export for every page.
create table private.export_chunks (
 job_id uuid not null references private.export_artifacts(job_id) on delete cascade,
 part_index integer not null,row_offset integer not null,table_name text not null,
 rows jsonb not null,next_offset integer,next_part integer,
 primary key(job_id,part_index,row_offset)
);
alter table private.export_chunks enable row level security;
create policy internal_only on private.export_chunks for all to authenticated using(false) with check(false);
revoke all on private.export_chunks from public,anon,authenticated;
create function private.chunk_export(target uuid,artifact jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.export_chunks where job_id=target;
 insert into private.export_chunks(job_id,part_index,row_offset,table_name,rows,next_offset,next_part)
 select target,(part.n-1)::int,off,part.value->>'table',
 jsonb_path_query_array(part.value->'rows',format('$[%s to %s]',off,off+499)::jsonpath),
 case when off+500<jsonb_array_length(part.value->'rows') then off+500 end,
 case when off+500>=jsonb_array_length(part.value->'rows') and part.n<jsonb_array_length(artifact) then part.n::int end
 from jsonb_array_elements(artifact) with ordinality part(value,n)
 cross join lateral generate_series(0,greatest(jsonb_array_length(part.value->'rows')-1,0),500) off;
end;$$;
create function private.export_chunks_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.chunk_export(new.job_id,new.data);return new;end;$$;
revoke all on function private.chunk_export(uuid,jsonb),private.export_chunks_changed() from public,anon,authenticated;
create trigger export_chunks_changed after insert or update of data on private.export_artifacts for each row execute function private.export_chunks_changed();
select private.chunk_export(job_id,data) from private.export_artifacts;
create or replace function private.export_page(org uuid,job uuid,part_index integer default 0,row_offset integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.export_jobs;chunk private.export_chunks;rows jsonb;t text;k text;next_offset integer;next_part integer;
begin
 select * into j from public.export_jobs where id=job and organization_id=org and user_id=auth.uid();
 if j.id is null then raise exception 'EXPORT_DENIED' using errcode='42501';end if;
 perform private.export_access(org,j.module);
 if j.status<>'done' or j.expires_at<=now() then raise exception 'EXPORT_NOT_READY';end if;
 if part_index is null or row_offset is null or part_index<0 or row_offset<0 or row_offset>1000000 then raise exception 'INVALID_EXPORT_PAGE';end if;
 select * into chunk from private.export_chunks c where c.job_id=job and c.part_index=export_page.part_index and c.row_offset=export_page.row_offset;
 if chunk.job_id is null or (j.format='csv' and part_index<>0) then raise exception 'INVALID_EXPORT_PAGE';end if;
 t:=chunk.table_name;k:=case when t='work_prices' then 'work_id' else 'id' end;
 execute format('select coalesce(jsonb_agg(e.value order by e.n),''[]'') from jsonb_array_elements($2) with ordinality as e(value,n) where exists(select 1 from public.%I r where r.organization_id=$1 and r.%I=(e.value->>%L)::uuid and (%s))',t,k,k,private.export_predicate(t)) into rows using org,chunk.rows;
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
  select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 next_offset:=chunk.next_offset;
 if j.format='xlsx' then next_part:=chunk.next_part;end if;
 return jsonb_build_object('module',j.module,'format',j.format,'table',t,'rows',rows,'next_offset',next_offset,'next_part',next_part);
end;$$;
