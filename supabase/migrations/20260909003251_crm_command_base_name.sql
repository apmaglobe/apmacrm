-- Renaming the implementation changes the PL/pgSQL qualified parameter name too.
do $$
declare definition text;
begin
  select replace(
    pg_get_functiondef('private.crm_command_base(uuid,text,jsonb,bigint,uuid)'::regprocedure),
    'crm_command.request_id',
    'crm_command_base.request_id'
  ) into definition;
  execute definition;
end;$$;
