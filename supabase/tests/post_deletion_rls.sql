-- Rollback-only test using two registered profiles and temporary Storage metadata.
-- This does not upload or delete actual file bytes; use an isolated test project.
begin;
create temporary table delete_test_users as select id,row_number() over(order by id) n from public.profiles limit 2;
create temporary table delete_test_posts(id uuid, kind text, image_path text);
grant select on delete_test_users to authenticated;
grant select,insert on delete_test_posts to authenticated;
do $$ begin
 if (select count(*) from delete_test_users)<>2 then raise exception 'Two accounts are required.'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from delete_test_users where n=1),true);
set local role authenticated;
with added as (insert into public.posts(user_id,body) select id,'Delete text test' from delete_test_users where n=1 returning id)
insert into delete_test_posts select id,'text',null from added;
do $$ declare uid uuid; image text; pid uuid; begin
 select id into uid from delete_test_users where n=1;
 image=uid::text||'/'||gen_random_uuid()::text||'.png';
 insert into storage.objects(bucket_id,name) values('ralli-post-images',image);
 insert into public.posts(user_id,body,image_path) values(uid,'',image) returning id into pid;
 insert into delete_test_posts values(pid,'image',image);
end $$;
select set_config('request.jwt.claim.sub',(select id::text from delete_test_users where n=2),true);
insert into public.comments(post_id,user_id,body) select p.id,u.id,'Other member comment' from delete_test_posts p cross join delete_test_users u where u.n=2;
insert into public.likes(post_id,user_id) select p.id,u.id from delete_test_posts p cross join delete_test_users u where u.n=2;
with added as (insert into public.posts(user_id,body) select id,'Keep B post' from delete_test_users where n=2 returning id)
insert into delete_test_posts select id,'other',null from added;
do $$ declare affected integer; begin
 delete from public.posts where id in(select id from delete_test_posts where kind in ('text','image'));
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL B deleted A posts'; end if;
 delete from storage.objects where bucket_id='ralli-post-images' and name=(select image_path from delete_test_posts where kind='image');
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL B deleted A photo'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from delete_test_users where n=1),true);
do $$ declare affected integer; image text; begin
 delete from public.posts where id=(select id from delete_test_posts where kind='other');
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL A deleted B post'; end if;
 delete from storage.objects where bucket_id='ralli-post-images' and name=(select image_path from delete_test_posts where kind='image');
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL image removed before post'; end if;
 delete from public.posts where id=(select id from delete_test_posts where kind='text');
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'FAIL owner text deletion'; end if;
 delete from public.posts where id=(select id from delete_test_posts where kind='image') returning image_path into image;
 if image is distinct from (select image_path from delete_test_posts where kind='image') then raise exception 'FAIL returned image path'; end if;
 if exists(select 1 from public.likes where post_id in(select id from delete_test_posts where kind in ('text','image'))) then raise exception 'FAIL likes cascade'; end if;
 if exists(select 1 from public.comments where post_id in(select id from delete_test_posts where kind in ('text','image'))) then raise exception 'FAIL comments cascade'; end if;
 if not exists(select 1 from storage.objects where bucket_id='ralli-post-images' and name=image) then raise exception 'FAIL photo removed before Storage cleanup'; end if;
 delete from storage.objects where bucket_id='ralli-post-images' and name=image;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'FAIL owner photo cleanup'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  delete from public.posts;
  raise exception 'FAIL anonymous deletion';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Post deletion ownership, cascades, image ordering, and anonymous denial passed; rolled back.' as result;
