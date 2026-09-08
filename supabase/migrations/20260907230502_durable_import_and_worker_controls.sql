-- A successful interactive batch authorizes continued processing of this exact persisted import.
-- No preview-only job is run by cron; current active admin authority is rechecked on every batch.
alter table public.import_jobs add column worker_user_id uuid references auth.users;
create index import_worker_user on public.import_jobs(worker_user_id);
create index imports_running on public.import_jobs(created_at) where status='running';
create function private.track_import_worker() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='running' and old.status is distinct from 'running' then
   new.worker_user_id:=auth.uid();
 end if;
 return new;
end;$$;
create trigger import_worker_authorization before update of status on public.import_jobs for each row execute function private.track_import_worker();
create function private.continue_imports() returns int language plpgsql security definer set search_path='' as $$
declare j public.import_jobs; claims text:=current_setting('request.jwt.claims',true); n int:=0;begin
 for j in select * from public.import_jobs where status='running' order by created_at limit 10 for update skip locked loop
 begin
   if not exists(select 1 from public.memberships where organization_id=j.organization_id and user_id=j.worker_user_id and status='active' and is_admin) then raise exception 'IMPORT_APPROVER_INACTIVE';end if;
   -- Trusted worker replays only the persisted, previously authorized batch as its approver.
   perform set_config('request.jwt.claims',jsonb_build_object('sub',j.worker_user_id,'role','authenticated','aal','aal2')::text,true);
   perform private.import_command(j.organization_id,'import.apply',jsonb_build_object('id',j.id),j.version,gen_random_uuid());
   n:=n+1;
 exception when others then
   update public.import_jobs set status='failed',errors=jsonb_build_array(jsonb_build_object('code',case when sqlerrm ~ '^[A-Z_]+$' then sqlerrm else 'IMPORT_WORKER_FAILED' end)),version=version+1 where id=j.id;
 end;
 end loop;
 perform set_config('request.jwt.claims',coalesce(claims,''),true);
 return n;
end;$$;
revoke all on function private.track_import_worker(),private.continue_imports() from public,anon,authenticated;
select cron.schedule('apma-crm-import-worker','* * * * *','select private.continue_imports()');
-- Guard against two cron invocations selecting stale recurring rows or webhook events concurrently.
alter function private.run_worker() rename to run_worker_v1;
create function private.run_worker() returns int language plpgsql security definer set search_path='' as $$begin
 if not pg_try_advisory_xact_lock(hashtextextended('apma-global-worker',0)) then return 0;end if;
 return private.run_worker_v1();
end;$$;
create or replace function public.run_worker() returns int language sql security invoker set search_path='' as $$select private.run_worker();$$;
revoke all on function private.run_worker(),private.run_worker_v1() from public,anon,authenticated;
grant execute on function private.run_worker() to service_role;
-- Keep operational history without retaining unbounded transient Realtime/rate-limit rows.
create function private.housekeeping() returns void language plpgsql security definer set search_path='' as $$begin
 delete from private.webhook_rate where minute<now()-interval '2 days';
 delete from public.outbox_events where created_at<now()-interval '30 days';
end;$$;
revoke all on function private.housekeeping() from public,anon,authenticated;
select cron.schedule('apma-crm-housekeeping','17 0 * * *','select private.housekeeping()');
