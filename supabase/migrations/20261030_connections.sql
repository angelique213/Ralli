-- Apply once. This creates a new table only; existing content is unchanged.
begin;
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint connections_pair_unique unique (follower_id, following_id),
  constraint connections_no_self check (follower_id <> following_id)
);
-- Profiles reference auth.users, so both ends belong to registered accounts.
create index connections_following on public.connections(following_id, created_at desc, id);
create index connections_follower_order on public.connections(follower_id, created_at desc, id);
alter table public.connections enable row level security;
revoke all on public.connections from anon, authenticated;
grant select on public.connections to authenticated;
grant insert (follower_id, following_id) on public.connections to authenticated;
grant delete on public.connections to authenticated;
create policy connections_read on public.connections for select to authenticated using (true);
create policy connections_create_own on public.connections for insert to authenticated
with check ((select auth.uid()) = follower_id);
create policy connections_delete_own on public.connections for delete to authenticated
using ((select auth.uid()) = follower_id);
-- No UPDATE grant or policy: connections can only be created or removed.
commit;
