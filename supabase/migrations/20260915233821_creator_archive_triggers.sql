-- Preserve a membership owner for records that legacy creation commands do not populate explicitly.
create or replace function private.set_membership_creator() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.created_by is null then new.created_by:=private.require_member(new.organization_id); end if;
 return new;
end;$$;
drop trigger if exists tools_set_membership_creator on public.tools;
create trigger tools_set_membership_creator before insert on public.tools for each row execute function private.set_membership_creator();
drop trigger if exists contracts_set_membership_creator on public.service_contracts;
create trigger contracts_set_membership_creator before insert on public.service_contracts for each row execute function private.set_membership_creator();
