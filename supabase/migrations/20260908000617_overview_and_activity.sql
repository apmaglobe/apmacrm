-- Caller RLS applies to every source; department amounts use only that department's work rows.
create function public.overview_report(org uuid, date_from date default null,date_to date default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;lo timestamptz:=coalesce(date_from,'1900-01-01'::date)::timestamp at time zone 'Asia/Baku';hi timestamptz:=(coalesce(date_to,'9998-12-30'::date)+1)::timestamp at time zone 'Asia/Baku';begin
 if private.member_id(org) is null then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if date_from>date_to then raise exception 'INVALID_DATE_RANGE';end if;
 with visible as materialized(select * from public.deals where organization_id=org and not archived),
 cohort as(select * from visible where pipeline='sales' and created_at>=lo and created_at<hi),
 works as materialized(select * from public.work_items where organization_id=org and not archived)
 select jsonb_build_object(
 'leads',(select count(*) from cohort),
 'cohort_won',(select count(*) from cohort where first_confirmed_at is not null),
 'first_sales',(select count(*) from visible where pipeline='sales' and first_confirmed_at>=lo and first_confirmed_at<hi),
 'delivered',(select count(*) from visible where pipeline='sales' and stage='delivered' and delivered_at>=lo and delivered_at<hi),
 'completed_work',(select count(*) from works where status='done'),
 'open_work',(select count(*) from works where status<>'done'),
 'overdue_work',(select count(*) from works where status<>'done' and due_at<now()),
 'stages',(select coalesce(jsonb_agg(x),'[]') from (select pipeline,stage,count(*) count from visible group by pipeline,stage)x),
 'workload',(select coalesce(jsonb_agg(x),'[]') from(select assignee_id,count(*) filter(where status<>'done') open,count(*) filter(where status='done') done,count(*) filter(where status<>'done' and due_at<now()) overdue from works group by assignee_id)x),
 'recurring',(select jsonb_build_object('periods',count(*),'done',count(*) filter(where d.stage='recurring_done'),'failed',count(*) filter(where p.status='failed')) from public.contract_periods p left join visible d on d.id=p.deal_id where p.organization_id=org and p.period_start>=coalesce(date_from,'1900-01-01'::date) and p.period_start<=coalesce(date_to,'9998-12-30'::date))
 ) into result;
 if private.permitted(org,'commercials.read') then
 result:=result||jsonb_build_object('department_sales',(select coalesce(jsonb_agg(x),'[]') from (
 select w.department_id,count(distinct d.id) deals,case when count(*) filter(where p.amount is null)>0 then null else sum(p.amount) end amount
 from public.deals d join public.work_items w on w.organization_id=d.organization_id and w.deal_id=d.id and not w.archived and w.kind='service'
 left join public.work_prices p on p.organization_id=w.organization_id and p.work_id=w.id
 where d.organization_id=org and not d.archived and d.pipeline='sales' and d.first_confirmed_at>=lo and d.first_confirmed_at<hi group by w.department_id)x));end if;
 if private.permitted(org,'finance.read') then
 result:=result||jsonb_build_object('cash_period',(select coalesce(sum(case direction when 'in' then amount else -amount end),0) from public.payments where organization_id=org and payment_date>=lo and payment_date<hi));end if;
 return result;end;$$;
revoke all on function public.overview_report(uuid,date,date) from public,anon;
grant execute on function public.overview_report(uuid,date,date) to authenticated;

-- One daily in-app summary for each current admin, even if a previous cron tick was missed.
create function private.daily_overdue_summary() returns int language plpgsql security definer set search_path='' as $$
declare n int;begin
 if (now() at time zone 'Asia/Baku')::time<time '09:00' then return 0;end if;
 insert into public.notifications(organization_id,recipient_id,event_key,label)
 select m.organization_id,m.id,'overdue-summary:'||(now() at time zone 'Asia/Baku')::date,
 'Gündəlik xülasə: '||count(w.id)||' gecikmiş iş'
 from public.memberships m join public.work_items w on w.organization_id=m.organization_id and not w.archived and w.status<>'done' and w.due_at<now()
 where m.is_admin and m.status='active' group by m.organization_id,m.id on conflict do nothing;
 get diagnostics n=row_count;return n;end;$$;
revoke all on function private.daily_overdue_summary() from public,anon,authenticated;
grant execute on function private.daily_overdue_summary() to service_role;
select cron.schedule('apma-crm-daily-summary','0 * * * *','select private.daily_overdue_summary()');
