begin;

-- Public names are separate from private authentication details.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create function public.ralli_sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Ralli Member'), 100))
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;
revoke all on function public.ralli_sync_profile() from public, anon, authenticated;
create trigger ralli_profile_sync after insert or update of raw_user_meta_data on auth.users
for each row execute function public.ralli_sync_profile();

-- Includes accounts that were registered before this migration.
insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data ->> 'display_name'), ''), 'Ralli Member'), 100)
from auth.users;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index posts_feed_order on public.posts(created_at desc, id desc);
create index posts_owner on public.posts(user_id);
create index comments_post_order on public.comments(post_id, created_at, id);
create index comments_owner on public.comments(user_id);
create index likes_owner on public.likes(user_id);

create function public.ralli_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.ralli_touch_updated_at() from public, anon, authenticated;
create trigger posts_updated before update on public.posts for each row execute function public.ralli_touch_updated_at();
create trigger comments_updated before update on public.comments for each row execute function public.ralli_touch_updated_at();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;

-- Explicit grants prevent users changing ownership, IDs, or timestamps.
revoke all on public.profiles, public.posts, public.comments, public.likes from anon, authenticated;
grant select on public.profiles, public.posts, public.comments, public.likes to anon, authenticated;
grant insert (body, user_id) on public.posts to authenticated;
grant insert (post_id, body, user_id) on public.comments to authenticated;
grant insert (post_id, user_id) on public.likes to authenticated;
grant update (body) on public.posts, public.comments to authenticated;
grant delete on public.posts, public.comments, public.likes to authenticated;

create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy posts_read on public.posts for select to anon, authenticated using (true);
create policy comments_read on public.comments for select to anon, authenticated using (true);
create policy likes_read on public.likes for select to anon, authenticated using (true);
create policy posts_create on public.posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy posts_edit on public.posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy posts_delete on public.posts for delete to authenticated using ((select auth.uid()) = user_id);
create policy comments_create on public.comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy comments_edit on public.comments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy comments_delete on public.comments for delete to authenticated using ((select auth.uid()) = user_id);
create policy likes_create on public.likes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy likes_delete on public.likes for delete to authenticated using ((select auth.uid()) = user_id);

commit;
