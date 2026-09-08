-- Read only the authenticated account's next login step. This does not grant CRM access.
create function private.login_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object(
  'has_active_membership',exists(select 1 from public.memberships where user_id=uid and status='active'),
  'requires_mfa',exists(select 1 from public.memberships where user_id=uid and status='active' and is_admin),
  'bootstrap_pending',exists(select 1 from auth.users u join private.bootstrap_admins b on b.email=lower(u.email) where u.id=uid and u.email_confirmed_at is not null and b.claimed_at is null)
 );
end;$$;
create function public.login_context() returns jsonb language sql security invoker set search_path='' as $$select private.login_context();$$;
revoke all on function private.login_context(),public.login_context() from public,anon,authenticated;
grant execute on function private.login_context(),public.login_context() to authenticated;
