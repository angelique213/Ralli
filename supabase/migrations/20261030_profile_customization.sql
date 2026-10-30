-- Apply once after 20261023_ralli_feed.sql. No existing posts or accounts are removed.
begin;
alter table public.profiles
  add column bio text not null default '' check (char_length(bio) <= 300),
  add column avatar_path text,
  add column cover_path text,
  add constraint profile_avatar_owner check (avatar_path is null or avatar_path like id::text || '/avatar/%'),
  add constraint profile_cover_owner check (cover_path is null or cover_path like id::text || '/cover/%');

-- Profile edits now belong to profiles, not potentially old Auth metadata.
create or replace function public.ralli_sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Ralli Member'), 100))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.ralli_sync_profile() from public, anon, authenticated;

alter table public.profiles enable row level security;
grant update (display_name, bio, avatar_path, cover_path) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Fails safely if this bucket name already exists; inspect rather than overwrite it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ralli-profile-images', 'ralli-profile-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy ralli_profile_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'ralli-profile-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] in ('avatar', 'cover')
  and lower(storage.extension(name)) in ('jpg', 'png', 'webp'));
create policy ralli_profile_images_select on storage.objects for select to authenticated
using (bucket_id = 'ralli-profile-images' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- These guards also constrain any broader pre-existing permissive policies.
create policy ralli_profile_owner_guard on public.profiles as restrictive for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy ralli_image_insert_guard on storage.objects as restrictive for insert to public
with check (bucket_id <> 'ralli-profile-images' or
  ((storage.foldername(name))[1] = (select auth.uid()::text)
   and (storage.foldername(name))[2] in ('avatar', 'cover')));
create policy ralli_image_update_guard on storage.objects as restrictive for update to public
using (bucket_id <> 'ralli-profile-images' or (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id <> 'ralli-profile-images' or (storage.foldername(name))[1] = (select auth.uid()::text));
create policy ralli_image_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id <> 'ralli-profile-images' or (storage.foldername(name))[1] = (select auth.uid()::text));
-- Images use unique paths. No overwrite or delete permission is needed by this UI.
commit;
