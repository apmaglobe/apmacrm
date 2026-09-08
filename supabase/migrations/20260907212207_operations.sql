create table public.tools (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 name text not null,kind text not null check(kind in('physical','digital')),capacity int not null check(capacity between 1 and 1000),
 state text not null default 'active' check(state in('active','broken','inactive')),version bigint not null default 1,unique(organization_id,id)
);
create table public.tool_reservations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,tool_id uuid not null,member_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,quantity int not null default 1 check(quantity>0),
 unit_number int,checked_out_at timestamptz,returned_at timestamptz,cancelled boolean not null default false,version bigint not null default 1,
 check(ends_at>starts_at),unique(organization_id,id),foreign key(organization_id,tool_id) references public.tools(organization_id,id),
 foreign key(organization_id,member_id) references public.memberships(organization_id,id)
);
create index tool_intervals on public.tool_reservations(organization_id,tool_id,starts_at,ends_at) where not cancelled;
create table public.resource_links (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,deal_id uuid not null,title text not null,url text not null check(url~'^https://[^[:space:]]+$'),
 category text,provider text not null default 'link',created_by uuid not null,archived boolean not null default false,version bigint not null default 1,
 foreign key(organization_id,deal_id) references public.deals(organization_id,id),foreign key(organization_id,created_by) references public.memberships(organization_id,id)
);
create table public.meetings (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,deal_id uuid,customer_id uuid,created_by uuid not null,
 title text not null,kind text not null check(kind in('online','in_person')),location text,url text check(url is null or url~'^https://[^[:space:]]+$'),
 starts_at timestamptz not null,ends_at timestamptz not null,agenda text,outcome text,cancelled boolean not null default false,
 version bigint not null default 1,unique(organization_id,id),check(ends_at>starts_at),
 foreign key(organization_id,deal_id) references public.deals(organization_id,id),foreign key(organization_id,customer_id) references public.customers(organization_id,id),
 foreign key(organization_id,created_by) references public.memberships(organization_id,id)
);
create table public.meeting_participants (
 organization_id uuid not null,meeting_id uuid not null,member_id uuid not null,primary key(organization_id,meeting_id,member_id),
 foreign key(organization_id,meeting_id) references public.meetings(organization_id,id),foreign key(organization_id,member_id) references public.memberships(organization_id,id)
);
create table public.conversations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,title text not null,
 created_by uuid not null,version bigint not null default 1,created_at timestamptz not null default now(),unique(organization_id,id),
 foreign key(organization_id,created_by) references public.memberships(organization_id,id)
);
create table public.conversation_members (
 organization_id uuid not null,conversation_id uuid not null,member_id uuid not null,joined_at timestamptz not null default now(),removed_at timestamptz,read_at timestamptz,
 primary key(organization_id,conversation_id,member_id),foreign key(organization_id,conversation_id) references public.conversations(organization_id,id),foreign key(organization_id,member_id) references public.memberships(organization_id,id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,conversation_id uuid not null,author_id uuid not null,
 body text not null check(length(body)<=4000),deleted boolean not null default false,version bigint not null default 1,created_at timestamptz not null default now(),
 unique(organization_id,id),foreign key(organization_id,conversation_id) references public.conversations(organization_id,id),foreign key(organization_id,author_id) references public.memberships(organization_id,id)
);
create index messages_conversation on public.messages(organization_id,conversation_id,created_at desc,id);
create table private.message_edits (id uuid primary key default gen_random_uuid(),organization_id uuid not null,message_id uuid not null,previous_body text not null,edited_at timestamptz not null default now());
create function private.chat_joined(org uuid,c uuid) returns timestamptz language sql stable security definer set search_path='' as $$select joined_at from public.conversation_members where organization_id=org and conversation_id=c and member_id=private.member_id(org) and removed_at is null;$$;
create function private.can_meet(org uuid,meet uuid) returns boolean language sql stable security definer set search_path='' as $$select private.member_id(org) is not null and exists(select 1 from public.meetings x where x.organization_id=org and x.id=meet and (private.is_admin(org) or x.created_by=private.member_id(org) or private.can_read_deal(org,x.deal_id) or exists(select 1 from public.meeting_participants p where p.organization_id=org and p.meeting_id=meet and p.member_id=private.member_id(org))));$$;
grant execute on function private.chat_joined(uuid,uuid),private.can_meet(uuid,uuid) to authenticated;
do $$declare t text;begin foreach t in array array['tools','tool_reservations','resource_links','meetings','meeting_participants','conversations','conversation_members','messages'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end$$;
create policy tools_read on public.tools for select to authenticated using(private.member_id(organization_id) is not null);
create policy reservations_read on public.tool_reservations for select to authenticated using(private.member_id(organization_id) is not null);
create policy links_read on public.resource_links for select to authenticated using(private.can_read_deal(organization_id,deal_id));
create policy meetings_read on public.meetings for select to authenticated using(private.can_meet(organization_id,id));
create policy meeting_participants_read on public.meeting_participants for select to authenticated using(private.can_meet(organization_id,meeting_id));
create policy conversation_read on public.conversations for select to authenticated using(private.chat_joined(organization_id,id) is not null);
create policy chat_members_read on public.conversation_members for select to authenticated using(private.chat_joined(organization_id,conversation_id) is not null);
create policy messages_read on public.messages for select to authenticated using(created_at>=private.chat_joined(organization_id,conversation_id));

create function private.operations_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m uuid;rid uuid;cid uuid;prior private.requests;result jsonb;t public.tools;r public.tool_reservations;mt public.meetings;msg public.messages;c public.conversations;occupied int;mid text;begin
 m:=private.require_member(org);perform pg_advisory_xact_lock(hashtextextended(org::text,0));
 select * into prior from private.requests q where q.organization_id=org and q.actor_id=auth.uid() and q.request_id=operations_command.request_id;
 if found then if prior.operation<>operation or prior.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 rid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 if operation='tool.save' then
 perform private.require_admin(org);select * into t from public.tools where organization_id=org and id=rid for update;
 if t.id is not null and t.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if t.id is not null and t.capacity>(payload->>'capacity')::int and exists(select 1 from public.tool_reservations where organization_id=org and tool_id=rid and not cancelled and returned_at is null) then raise exception 'ACTIVE_RESERVATIONS_CAPACITY';end if;
 insert into public.tools(id,organization_id,name,kind,capacity,state) values(rid,org,payload->>'name',payload->>'kind',(payload->>'capacity')::int,coalesce(payload->>'state','active'))
 on conflict(id) do update set name=excluded.name,capacity=excluded.capacity,state=excluded.state,version=tools.version+1 where tools.organization_id=org;
 elsif operation='tool.reserve' then
 select * into t from public.tools where organization_id=org and id=(payload->>'tool_id')::uuid for update;
 if t.id is null or t.state<>'active' then raise exception 'TOOL_UNAVAILABLE';end if;
 if (payload->>'ends_at')::timestamptz<=(payload->>'starts_at')::timestamptz then raise exception 'INVALID_INTERVAL';end if;
 if t.kind='physical' and (nullif(payload->>'unit_number','')::int not between 1 and t.capacity or payload->>'unit_number' is null or coalesce((payload->>'quantity')::int,1)<>1) then raise exception 'PHYSICAL_UNIT_REQUIRED';end if;
 -- Count peak concurrent occupancy at interval boundaries, not sum of non-overlapping reservations.
 select coalesce(max(load),0) into occupied from (
 select sum(q.quantity)::int load from public.tool_reservations q
 join (select (payload->>'starts_at')::timestamptz at union select starts_at from public.tool_reservations where organization_id=org and tool_id=t.id and starts_at>=(payload->>'starts_at')::timestamptz and starts_at<(payload->>'ends_at')::timestamptz) points
 on q.starts_at<=points.at and (q.ends_at>points.at or q.checked_out_at is not null and q.returned_at is null)
 where q.organization_id=org and q.tool_id=t.id and not q.cancelled and q.returned_at is null and (t.kind='digital' or q.unit_number=(payload->>'unit_number')::int) group by points.at) loads;
 if occupied+coalesce((payload->>'quantity')::int,1)>(case when t.kind='physical' then 1 else t.capacity end) then raise exception 'TOOL_CAPACITY_CONFLICT';end if;
 insert into public.tool_reservations(id,organization_id,tool_id,member_id,starts_at,ends_at,quantity,unit_number)
 values(rid,org,t.id,m,(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,coalesce((payload->>'quantity')::int,1),nullif(payload->>'unit_number','')::int);
 elsif operation in('tool.checkout','tool.return','tool.cancel') then
 select * into r from public.tool_reservations where organization_id=org and id=rid for update;
 if r.id is null or not(private.is_admin(org) or r.member_id=m) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if r.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if operation='tool.checkout' then
 if r.cancelled or r.returned_at is not null or now()<r.starts_at or now()>=r.ends_at then raise exception 'INVALID_CHECKOUT';end if;
 select * into t from public.tools where organization_id=org and id=r.tool_id for update;
 if t.state<>'active' or exists(select 1 from public.tool_reservations where organization_id=org and tool_id=r.tool_id and id<>rid and checked_out_at is not null and returned_at is null and (t.kind='digital' or unit_number=r.unit_number)) then raise exception 'TOOL_NOT_RETURNED';end if;
 update public.tool_reservations set checked_out_at=coalesce(checked_out_at,now()),version=version+1 where id=rid;
 elsif operation='tool.return' then if r.checked_out_at is null then raise exception 'NOT_CHECKED_OUT';end if;update public.tool_reservations set returned_at=coalesce(returned_at,now()),version=version+1 where id=rid;
 else if r.checked_out_at is not null and r.returned_at is null then raise exception 'RETURN_REQUIRED';end if;update public.tool_reservations set cancelled=true,version=version+1 where id=rid;end if;
 elsif operation='link.save' then
 if not private.can_edit_deal(org,(payload->>'deal_id')::uuid) then raise exception 'EDIT_DENIED' using errcode='42501';end if;
 if exists(select 1 from public.resource_links where organization_id=org and id=rid and (version<>expected_version or deal_id<>(payload->>'deal_id')::uuid)) then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 insert into public.resource_links(id,organization_id,deal_id,title,url,category,created_by) values(rid,org,(payload->>'deal_id')::uuid,payload->>'title',payload->>'url',payload->>'category',m)
 on conflict(id) do update set title=excluded.title,url=excluded.url,category=excluded.category,archived=coalesce((payload->>'archived')::boolean,resource_links.archived),version=resource_links.version+1 where resource_links.organization_id=org;
 elsif operation='meeting.save' then
 select * into mt from public.meetings where organization_id=org and id=rid for update;
 if mt.id is not null and (mt.created_by<>m and not private.is_admin(org)) then raise exception 'EDIT_DENIED' using errcode='42501';end if;
 if mt.id is not null and mt.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if nullif(payload->>'deal_id','') is not null and not private.can_read_deal(org,(payload->>'deal_id')::uuid) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 insert into public.meetings(id,organization_id,created_by,deal_id,customer_id,title,kind,location,url,starts_at,ends_at,agenda,outcome)
 values(rid,org,m,nullif(payload->>'deal_id','')::uuid,nullif(payload->>'customer_id','')::uuid,payload->>'title',payload->>'kind',payload->>'location',nullif(payload->>'url',''),(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,payload->>'agenda',payload->>'outcome')
 on conflict(id) do update set title=excluded.title,location=excluded.location,url=excluded.url,starts_at=excluded.starts_at,ends_at=excluded.ends_at,agenda=excluded.agenda,outcome=excluded.outcome,cancelled=coalesce((payload->>'cancelled')::boolean,meetings.cancelled),version=meetings.version+1 where meetings.organization_id=org;
 delete from public.meeting_participants where organization_id=org and meeting_id=rid;
 for mid in select jsonb_array_elements_text(coalesce(payload->'participants','[]')) loop
 if not exists(select 1 from public.memberships where organization_id=org and id=mid::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 insert into public.meeting_participants values(org,rid,mid::uuid);end loop;
 elsif operation='conversation.create' then
 insert into public.conversations(id,organization_id,title,created_by) values(rid,org,payload->>'title',m);
 insert into public.conversation_members(organization_id,conversation_id,member_id) values(org,rid,m);
 for mid in select jsonb_array_elements_text(coalesce(payload->'members','[]')) loop
 if not exists(select 1 from public.memberships where organization_id=org and id=mid::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 insert into public.conversation_members(organization_id,conversation_id,member_id) values(org,rid,mid::uuid) on conflict do nothing;end loop;
 elsif operation in('conversation.member','conversation.read') then
 cid:=(payload->>'conversation_id')::uuid;if private.chat_joined(org,cid) is null then raise exception 'CHAT_ACCESS_DENIED' using errcode='42501';end if;
 if operation='conversation.read' then update public.conversation_members set read_at=now() where organization_id=org and conversation_id=cid and member_id=m;
 else select * into c from public.conversations where organization_id=org and id=cid for update;
 if c.created_by<>m then raise exception 'CHAT_OWNER_REQUIRED' using errcode='42501';end if;
 if c.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 if (payload->>'enabled')::boolean then
 if not exists(select 1 from public.memberships where organization_id=org and id=(payload->>'member_id')::uuid and status='active') then raise exception 'INACTIVE_ASSIGNEE';end if;
 insert into public.conversation_members(organization_id,conversation_id,member_id) values(org,cid,(payload->>'member_id')::uuid)
 on conflict(organization_id,conversation_id,member_id) do update set joined_at=now(),removed_at=null where conversation_members.removed_at is not null;
 else update public.conversation_members set removed_at=now() where organization_id=org and conversation_id=cid and member_id=(payload->>'member_id')::uuid;end if;
 update public.conversations set version=version+1 where id=cid;end if;
 elsif operation in('message.send','message.edit') then
 cid:=(payload->>'conversation_id')::uuid;if private.chat_joined(org,cid) is null then raise exception 'CHAT_ACCESS_DENIED' using errcode='42501';end if;
 if operation='message.send' then
 if nullif(trim(payload->>'body'),'') is null then raise exception 'MESSAGE_REQUIRED';end if;
 insert into public.messages(id,organization_id,conversation_id,author_id,body) values(rid,org,cid,m,payload->>'body');
 else
 select * into msg from public.messages where organization_id=org and conversation_id=cid and id=rid for update;
 if msg.author_id is distinct from m or msg.created_at<now()-interval '15 minutes' then raise exception 'MESSAGE_EDIT_WINDOW' using errcode='42501';end if;
 if msg.version<>expected_version then raise exception 'VERSION_CONFLICT' using errcode='40001';end if;
 insert into private.message_edits(organization_id,message_id,previous_body) values(org,rid,msg.body);
 update public.messages set body=case when (payload->>'deleted')::boolean then '' else payload->>'body' end,deleted=coalesce((payload->>'deleted')::boolean,false),version=version+1 where id=rid;end if;
 elsif operation='notification.read' then update public.notifications set read_at=now() where organization_id=org and id=rid and recipient_id=m;
 else raise exception 'UNKNOWN_OPERATION';end if;
 result:=jsonb_build_object('id',rid);
 if operation not like 'message.%' and operation not like 'conversation.%' then
 insert into public.audit_events(organization_id,deal_id,actor_id,action,visibility,after_data) values(org,nullif(payload->>'deal_id','')::uuid,auth.uid(),operation,case when payload->>'deal_id' is null then 'admin' else 'object' end,result);end if;
 insert into public.outbox_events(organization_id,topic,entity_id) values(org,case when cid is not null then 'chat' else 'operations' end,coalesce(cid,rid));
 insert into private.requests values(org,auth.uid(),request_id,operation,payload,result);return result;
end;$$;
create function public.operations_command(org uuid,operation text,payload jsonb,expected_version bigint,request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select private.operations_command(org,operation,payload,expected_version,request_id);$$;
grant execute on function private.operations_command(uuid,text,jsonb,bigint,uuid),public.operations_command(uuid,text,jsonb,bigint,uuid) to authenticated;
