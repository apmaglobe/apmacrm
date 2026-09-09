-- Renaming the prior wrapper changes its qualified parameter name in PL/pgSQL.
do $$
declare definition text;
begin
  select replace(
    pg_get_functiondef('private.crm_command_owner_base(uuid,text,jsonb,bigint,uuid)'::regprocedure),
    'crm_command.request_id',
    'crm_command_owner_base.request_id'
  ) into definition;
  execute definition;
end;$$;
