-- Explicit denial documents the private RPC-only boundary; covering indexes support FK checks and rate limits.
create policy internal_only on private.join_links for all to authenticated using(false) with check(false);
create policy internal_only on private.invitation_tokens for all to authenticated using(false) with check(false);
create policy internal_only on private.join_requests for all to authenticated using(false) with check(false);
create index join_links_creator on private.join_links(created_by,organization_id,created_at);
create index invitations_creator on public.invitations(created_by,organization_id,created_at);
create index join_requests_decider on private.join_requests(decided_by);
create index join_requests_org_member on private.join_requests(organization_id,member_id);
