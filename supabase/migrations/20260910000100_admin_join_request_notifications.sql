-- A link acceptance is an access request, so every active administrator gets
-- a tenant-scoped in-app notification.  The key makes retries and concurrent
-- acceptance attempts harmless.
create or replace function private.notify_admins_of_join_request() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(organization_id,recipient_id,event_key,label)
 select new.organization_id,m.id,'membership-request:'||new.member_id::text,'Yeni qoşulma müraciəti'
 from public.memberships m
 where m.organization_id=new.organization_id and m.status='active' and m.is_admin
 on conflict(organization_id,recipient_id,event_key) do nothing;
 return new;
end;$$;

revoke all on function private.notify_admins_of_join_request() from public,anon,authenticated;
drop trigger if exists join_request_admin_notification on private.join_requests;
create trigger join_request_admin_notification
 after insert on private.join_requests
 for each row execute function private.notify_admins_of_join_request();
