-- Run as a single rollback-only SQL test after the post-image migration.
-- Uses temporary metadata fixtures, not real Storage file bytes. Requires two profiles.
begin;
create temporary table post_image_users as select id,row_number() over(order by id) n from public.profiles limit 2;
grant select on post_image_users to authenticated;
do $$ begin
 if (select count(*) from post_image_users)<>2 then raise exception 'Two accounts are required.'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from post_image_users where n=1),true);
set local role authenticated;
do $$ declare a uuid; b uuid; image text; pid uuid; affected integer; begin
 select id into a from post_image_users where n=1;
 select id into b from post_image_users where n=2;
 image=a::text||'/'||gen_random_uuid()::text||'.png';
 insert into storage.objects(bucket_id,name) values('ralli-post-images',image);
 insert into public.posts(user_id,body,image_path) values(a,'',image) returning id into pid;
 if not exists(select 1 from public.posts where id=pid and body='' and image_path=image) then raise exception 'FAIL image-only post'; end if;
 begin
  insert into public.posts(user_id,body) values(a,E' \t\n');
  raise exception 'FAIL empty post';
 exception when check_violation then null; end;
 begin
  insert into public.posts(user_id,body,image_path) values(a,'Missing image',a::text||'/'||gen_random_uuid()::text||'.png');
  raise exception 'FAIL nonexistent image';
 exception when check_violation then null; end;
 begin
  insert into storage.objects(bucket_id,name) values('ralli-post-images',b::text||'/'||gen_random_uuid()::text||'.png');
  raise exception 'FAIL foreign upload';
 exception when insufficient_privilege then null; end;
 begin
  insert into storage.objects(bucket_id,name) values('ralli-post-images',a::text||'/'||gen_random_uuid()::text||'.svg');
  raise exception 'FAIL invalid extension';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.posts(user_id,body,image_path) values(a,'Duplicate attachment',image);
  raise exception 'FAIL duplicate attachment';
 exception when unique_violation then null; end;
 begin
  update public.posts set image_path=null where id=pid;
  raise exception 'FAIL attachment update';
 exception when insufficient_privilege then null; end;
 delete from storage.objects where bucket_id='ralli-post-images' and name=image;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL deleted published image'; end if;
 image=a::text||'/'||gen_random_uuid()::text||'.webp';
 insert into storage.objects(bucket_id,name) values('ralli-post-images',image);
 delete from storage.objects where bucket_id='ralli-post-images' and name=image;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'FAIL unused upload cleanup'; end if;
end $$;
reset role;
-- Simulate an accidentally broad policy; the new restrictive guards still apply.
create policy post_images_test_broad_update on storage.objects for update to authenticated using(true) with check(true);
create policy post_images_test_broad_delete on storage.objects for delete to authenticated using(true);
create policy post_images_test_broad_select on storage.objects for select to authenticated using(true);
set local role authenticated;
do $$ declare affected integer; begin
 update storage.objects set name=name where bucket_id='ralli-post-images' and name like (select id::text||'/%' from post_image_users where n=1);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL overwrote image'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from post_image_users where n=2),true);
do $$ declare a uuid; b uuid; image text; affected integer; begin
 select id into a from post_image_users where n=1;
 select id into b from post_image_users where n=2;
 select image_path into image from public.posts where user_id=a and image_path is not null limit 1;
 begin
  insert into public.posts(user_id,body,image_path) values(b,'Stolen image',image);
  raise exception 'FAIL foreign image reference';
 exception when check_violation then null; end;
 delete from storage.objects where bucket_id='ralli-post-images' and name=image;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL foreign delete'; end if;
 update public.posts set body='Unauthorized' where user_id=a;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL foreign post edit'; end if;
end $$;
reset role;
rollback;
select 'Post image checks passed; metadata fixtures and test policies rolled back.' as result;
