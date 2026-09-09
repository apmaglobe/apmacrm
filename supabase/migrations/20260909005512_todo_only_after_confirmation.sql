-- Sales work may be planned during the meeting stage, but it becomes an assignee's
-- To Do only after the order has been confirmed. Recurring orders are generated work.
create or replace function private.todo_items(org uuid,scope text,search text,skip_rows int) returns setof public.work_items language plpgsql stable security definer set search_path='' as $$
declare m uuid:=private.require_member(org); admin boolean:=private.is_admin(org); begin
 if scope not in('mine','own','shared','team') or scope='team' and not admin then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
 return query with eligible as materialized(
   select d.id from public.deals d where d.organization_id=org and not d.archived
   and (d.pipeline='recurring' or d.first_confirmed_at is not null or d.stage in('confirmed','in_progress','delivered'))
 ), shared as materialized(
   select d.id from public.deals d join eligible e on e.id=d.id where d.organization_id=org and m in(d.created_by,d.accountable_id,d.mediator_id)
   union select dm.deal_id from public.deal_members dm join eligible e on e.id=dm.deal_id where dm.organization_id=org and dm.member_id=m
   union select w.deal_id from public.work_items w join eligible e on e.id=w.deal_id where w.organization_id=org and not w.archived and w.assignee_id=m
 ) select w.* from public.work_items w join eligible e on e.id=w.deal_id
 where w.organization_id=org and not w.archived
 and (scope='team' and admin or scope in('mine','own') and w.assignee_id=m or scope='shared' and w.deal_id in(select id from shared))
 and strpos(lower(w.name),lower(left(coalesce(search,''),120)))>0
 order by w.due_at asc nulls last,w.id offset greatest(skip_rows,0) limit 200;
end;$$;
