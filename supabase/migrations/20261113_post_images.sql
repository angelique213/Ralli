-- Apply once after the existing feed migration. No existing posts are deleted.
begin;
alter table public.posts add column image_path text;
-- This is the constraint name created by 20261023_ralli_feed.sql.
alter table public.posts drop constraint posts_body_check;
alter table public.posts add constraint posts_content_check check (
  char_length(body) <= 5000 and (body ~ '[^[:space:]]' or image_path is not null)
);
alter table public.posts add constraint posts_image_owner check (
  image_path is null or image_path ~ ('^' || user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
);
create unique index posts_image_unique on public.posts(image_path) where image_path is not null;
grant insert (image_path) on public.posts to authenticated;
-- No image UPDATE grant: a published attachment is not replaced by this feature.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ralli-post-images','ralli-post-images',true,5242880,array['image/jpeg','image/png','image/webp']);

create policy post_images_insert on storage.objects for insert to authenticated
with check (bucket_id='ralli-post-images' and (storage.foldername(name))[1]=(select auth.uid()::text)
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
create policy post_images_select_own on storage.objects for select to authenticated
using (bucket_id='ralli-post-images' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy post_images_delete_unused on storage.objects for delete to authenticated
using (bucket_id='ralli-post-images' and (storage.foldername(name))[1]=(select auth.uid()::text)
  and not exists(select 1 from public.posts where image_path=name));
-- Restrictive guards also protect this bucket from broader existing policies.
create policy post_images_insert_guard on storage.objects as restrictive for insert to public
with check (bucket_id<>'ralli-post-images' or (
  (storage.foldername(name))[1]=(select auth.uid()::text)
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'));
create policy post_images_no_overwrite on storage.objects as restrictive for update to public
using (bucket_id<>'ralli-post-images') with check (bucket_id<>'ralli-post-images');
create policy post_images_delete_guard on storage.objects as restrictive for delete to public
using (bucket_id<>'ralli-post-images' or (
  (storage.foldername(name))[1]=(select auth.uid()::text)
  and not exists(select 1 from public.posts where image_path=name)));

-- An image post must point to an uploaded object visible to its owner.
create function public.ralli_check_post_image() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.image_path is not null and not exists (
    select 1 from storage.objects where bucket_id='ralli-post-images' and name=new.image_path
  ) then
    raise exception 'Upload the post image before publishing.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.ralli_check_post_image() from public,anon,authenticated;
create trigger posts_image_exists before insert or update of image_path,user_id on public.posts
for each row execute function public.ralli_check_post_image();
commit;
