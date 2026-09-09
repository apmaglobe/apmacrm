-- A stale application version is a final HTTP conflict, not a retryable PostgreSQL serialization failure.
-- Some deployed PostgREST versions retry SQLSTATE 40001 indefinitely. Preserve the semantic code.
do $$
declare f record; definition text; old_clause text := 'raise exception ''VERSION_CONFLICT'' using errcode=''40001''';
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.prokind='f' and strpos(p.prosrc,old_clause)>0
 loop
  definition:=replace(pg_get_functiondef(f.oid),old_clause,'raise exception ''VERSION_CONFLICT'' using errcode=''PT409''');
  execute definition;
 end loop;
end;$$;
