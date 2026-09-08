create or replace function private.export_snapshot(org uuid,m text,filters jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text; result jsonb:='[]';rows jsonb;clause text;parent text;parent_key text;ids jsonb;search text:=left(coalesce(filters->>'q',''),120);begin
 perform private.export_access(org,m);
 foreach t in array private.export_tables(m) loop
 clause:=private.export_predicate(t);parent:=null;parent_key:=null;
 if t='work_items' and m='crm' then parent:='deal_cards';parent_key:='deal_id';
 elsif t='work_prices' then parent:='work_items';parent_key:='work_id';
 elsif t in('customer_locations','contacts') then parent:='customers';parent_key:='customer_id';end if;
 if parent is not null then
 select coalesce(jsonb_agg(row->>'id'),'[]') into ids from jsonb_array_elements(result) part cross join lateral jsonb_array_elements(part->'rows') row where part->>'table'=parent;
 clause:=clause||format(' and r.%I::text in(select jsonb_array_elements_text(%L::jsonb))',parent_key,ids::text);
 elsif search<>'' and t in('customers','deal_cards','work_items','tools','meetings','resource_links','memberships','service_contracts','financial_documents','payments') then
 clause:=clause||format(' and strpos(lower(coalesce(r.%I,'''')),lower(%L))>0',case when t in('deal_cards','meetings','resource_links','service_contracts') then 'title' when t='financial_documents' then 'counterparty' when t='payments' then 'note' else 'name' end,search);
 end if;
 if t='portfolio_items' and search<>'' then clause:=clause||format(' and exists(select 1 from public.deals d where d.organization_id=r.organization_id and d.id=r.deal_id and strpos(lower(coalesce(d.title,'''')),lower(%L))>0)',search);end if;
 if t in('customers','work_items') then clause:=clause||' and not r.archived';end if;
 if t='deal_cards' then clause:=clause||replace(private.deal_filter_sql(filters),'d.','r.');end if;
 if t='deal_cards' and filters->>'pipeline' in('sales','recurring') then clause:=clause||format(' and r.pipeline=%L',filters->>'pipeline');end if;
 if m='todo' and coalesce(filters->>'scope','own')<>'shared' and not (private.is_admin(org) and filters->>'scope'='team') then clause:=clause||format(' and r.assignee_id=%L::uuid',private.member_id(org));end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)-array[''user_id'',''overrides'',''join_token'',''template_snapshot'',''intake''] order by r.%I),''[]'') from public.%I r where r.organization_id=$1 and (%s)',case when t='work_prices' then 'work_id' else 'id' end,t,clause) into rows using org;
 -- The definer context must not make view-derived price columns bypass field permission.
 if t='deal_cards' and not private.permitted(org,'commercials.read') then
 select coalesce(jsonb_agg(value-array['commercial','total','total_amount','total_cents','amount','amount_cents']),'[]') into rows from jsonb_array_elements(rows);
 end if;
 result:=result||jsonb_build_array(jsonb_build_object('table',t,'rows',rows));
 end loop;return result;
end;$$;
