-- Minimal private invalidation; sensitive rows are always fetched again under current RLS.
create policy crm_private_topics on realtime.messages for select to authenticated using(
 realtime.topic()='member:'||(select auth.uid())::text and exists(select 1 from public.memberships where user_id=auth.uid() and status='active')
);
create function private.broadcast_outbox() returns trigger language plpgsql security definer set search_path='' as $$declare m record;begin
 for m in select distinct user_id from public.memberships where organization_id=new.organization_id and status='active'
 and (new.topic<>'chat' or exists(select 1 from public.conversation_members cm where cm.organization_id=new.organization_id and cm.conversation_id=new.entity_id and cm.member_id=memberships.id and cm.removed_at is null)) loop
 perform realtime.send(jsonb_build_object('event_id',new.id),'invalidate','member:'||m.user_id::text,true);
 end loop;return new;end;$$;
create trigger outbox_broadcast after insert on public.outbox_events for each row execute function private.broadcast_outbox();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('crm-private','crm-private',false,10485760,array['image/png','image/jpeg','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream']) on conflict(id) do nothing;
create function private.storage_allowed(path text,writing boolean) returns boolean language plpgsql stable security definer set search_path='' as $$declare org uuid;owner_id uuid;begin
 begin org:=split_part(path,'/',1)::uuid;owner_id:=split_part(path,'/',3)::uuid;exception when others then return false;end;
 return private.member_id(org) is not null and (case split_part(path,'/',2) when 'imports' then private.is_admin(org) when 'avatars' then not writing or owner_id=auth.uid() or private.is_admin(org) when 'logos' then not writing or private.is_admin(org) else false end);
end;$$;
grant execute on function private.storage_allowed(text,boolean) to authenticated;
create policy crm_storage_select on storage.objects for select to authenticated using(bucket_id='crm-private' and private.storage_allowed(name,false));
create policy crm_storage_insert on storage.objects for insert to authenticated with check(bucket_id='crm-private' and private.storage_allowed(name,true));
create policy crm_storage_update on storage.objects for update to authenticated using(bucket_id='crm-private' and private.storage_allowed(name,true)) with check(bucket_id='crm-private' and private.storage_allowed(name,true));

create table public.webhook_endpoints(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 name text not null,department_id uuid not null,default_admin_id uuid not null,enabled boolean not null default true,
 unique(organization_id,id),foreign key(organization_id,department_id) references public.departments(organization_id,id),foreign key(organization_id,default_admin_id) references public.memberships(organization_id,id));
create table public.webhook_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null,endpoint_id uuid not null,
 external_event_id text not null,payload jsonb not null,payload_hash text not null,status text not null default 'queued',deal_id uuid,
 attempts int not null default 0,last_error text,created_at timestamptz not null default now(),unique(organization_id,endpoint_id,external_event_id),
 foreign key(organization_id,endpoint_id) references public.webhook_endpoints(organization_id,id),foreign key(organization_id,deal_id) references public.deals(organization_id,id));
create table private.webhook_rate(endpoint_id uuid not null,minute timestamptz not null,count int not null,primary key(endpoint_id,minute));
alter table public.webhook_endpoints enable row level security;alter table public.webhook_events enable row level security;
revoke all on public.webhook_endpoints,public.webhook_events from anon,authenticated;grant select on public.webhook_endpoints,public.webhook_events to authenticated;
create policy endpoint_admin on public.webhook_endpoints for select to authenticated using(private.is_admin(organization_id));
create policy webhook_admin on public.webhook_events for select to authenticated using(private.is_admin(organization_id));
create function private.accept_webhook(endpoint uuid,payload jsonb,payload_hash text) returns uuid language plpgsql security definer set search_path='' as $$declare e public.webhook_endpoints;ev public.webhook_events;n int;begin
 select * into e from public.webhook_endpoints where id=endpoint and enabled;if e.id is null then raise exception 'ENDPOINT_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock(hashtextextended(e.organization_id::text,0));
 insert into private.webhook_rate values(endpoint,date_trunc('minute',now()),1) on conflict(endpoint_id,minute) do update set count=private.webhook_rate.count+1 returning count into n;
 if n>60 then raise exception 'RATE_LIMIT';end if;
 select * into ev from public.webhook_events where organization_id=e.organization_id and endpoint_id=endpoint and external_event_id=payload->>'external_event_id';
 if ev.id is not null then if ev.payload_hash<>payload_hash then raise exception 'PAYLOAD_CONFLICT';end if;return ev.id;end if;
 insert into public.webhook_events(organization_id,endpoint_id,external_event_id,payload,payload_hash) values(e.organization_id,endpoint,payload->>'external_event_id',payload,payload_hash) returning id into ev.id;return ev.id;
end;$$;
create function public.accept_webhook(endpoint uuid,payload jsonb,payload_hash text) returns uuid language sql security invoker set search_path='' as $$select private.accept_webhook(endpoint,payload,payload_hash);$$;
grant execute on function private.accept_webhook(uuid,jsonb,text),public.accept_webhook(uuid,jsonb,text) to service_role;
create function private.run_worker() returns int language plpgsql security definer set search_path='' as $$declare c record;e public.webhook_events;ep public.webhook_endpoints;customer uuid;d uuid;num bigint;yr int;n int:=0;begin
 for c in select organization_id,id from public.service_contracts where status='active' and next_period_start<=(now() at time zone 'Asia/Baku')::date limit 30 loop
 perform pg_advisory_xact_lock(hashtextextended(c.organization_id::text,0));perform private.generate_period(c.organization_id,c.id);n:=n+1;end loop;
 for e in select * from public.webhook_events where status in('queued','failed') and attempts<5 order by created_at limit 30 for update skip locked loop
 begin
 select * into ep from public.webhook_endpoints where id=e.endpoint_id;
 if not exists(select 1 from public.memberships where organization_id=e.organization_id and id=ep.default_admin_id and is_admin and status='active') then raise exception 'DEFAULT_ADMIN_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock(hashtextextended(e.organization_id::text,0));
 select id into customer from public.customers where organization_id=e.organization_id and external_id=e.payload->>'customer_external_id';
 yr:=extract(year from now() at time zone 'Asia/Baku');
 insert into private.serials values(e.organization_id,yr,1) on conflict(organization_id,year) do update set value=private.serials.value+1 returning value into num;
 insert into public.deals(organization_id,serial,title,customer_id,accountable_id,creation_source,intake_department_id,intake)
 values(e.organization_id,'CRM-'||yr||'-'||lpad(num::text,6,'0'),e.payload->>'company_name',customer,ep.default_admin_id,'webhook',ep.department_id,e.payload) returning id into d;
 update public.webhook_events set status='done',deal_id=d,attempts=attempts+1,last_error=null where id=e.id;perform private.emit(e.organization_id,d,'webhook.created',1);n:=n+1;
 exception when others then update public.webhook_events set status='failed',last_error=sqlerrm,attempts=attempts+1 where id=e.id;end;end loop;
 -- Source version is part of the key: old deadlines no longer generate new notifications.
 insert into public.notifications(organization_id,recipient_id,deal_id,event_key,label)
 select w.organization_id,w.assignee_id,w.deal_id,'deadline:'||w.id||':'||w.version||':'||h.hours,'İşin deadline-ı yaxınlaşır'
 from public.work_items w cross join(values(24),(2)) h(hours) join public.memberships m on m.id=w.assignee_id and m.organization_id=w.organization_id and m.status='active'
 where not w.archived and w.status<>'done' and w.due_at between now()+make_interval(hours=>h.hours)-interval '1 minute' and now()+make_interval(hours=>h.hours)
 on conflict do nothing;
 return n;end;$$;
create function public.run_worker() returns int language sql security invoker set search_path='' as $$select private.run_worker();$$;
grant execute on function private.run_worker(),public.run_worker() to service_role;
create extension if not exists pg_cron;
select cron.schedule('apma-crm-worker','* * * * *','select private.run_worker()');
