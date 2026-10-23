-- Run after the migration, with at least two registered accounts.
-- All test content is rolled back. Run the whole file at once in SQL Editor.
begin;
create temporary table test_users as select id, row_number() over (order by id) as number from public.profiles limit 2;
create temporary table test_records (kind text, id uuid);
grant select on test_users to authenticated, anon;
grant all on test_records to authenticated, anon;
do $$ begin
  if (select count(*) from test_users) < 2 then raise exception 'Register two test accounts first.'; end if;
end $$;

select set_config('request.jwt.claim.sub', (select id::text from test_users where number = 1), true);
set local role authenticated;
with saved as (insert into public.posts(body) values ('RLS test post') returning id)
insert into test_records select 'post', id from saved;
with saved as (insert into public.comments(post_id, body) select id, 'RLS test comment' from test_records where kind = 'post' returning id)
insert into test_records select 'comment', id from saved;
insert into public.likes(post_id) select id from test_records where kind = 'post';

-- The same account cannot add a duplicate like or impersonate another author.
do $$ begin
  begin
    insert into public.likes(post_id) select id from test_records where kind = 'post';
    raise exception 'FAIL: duplicate like allowed';
  exception when unique_violation then null; end;
  begin
    insert into public.posts(user_id, body) select id, 'Spoofed author' from test_users where number = 2;
    raise exception 'FAIL: spoofed author allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.posts(body) values (E' \n\t');
    raise exception 'FAIL: whitespace post allowed';
  exception when check_violation then null; end;
end $$;

-- The second account can read but cannot change the first account's content.
select set_config('request.jwt.claim.sub', (select id::text from test_users where number = 2), true);
do $$ declare affected integer; begin
  update public.posts set body = 'Unauthorized edit' where id = (select id from test_records where kind = 'post');
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: edited another user post'; end if;
  delete from public.posts where id = (select id from test_records where kind = 'post');
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: deleted another user post'; end if;
  update public.comments set body = 'Unauthorized edit' where id = (select id from test_records where kind = 'comment');
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: edited another user comment'; end if;
  delete from public.comments where id = (select id from test_records where kind = 'comment');
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: deleted another user comment'; end if;
  delete from public.likes where post_id = (select id from test_records where kind = 'post');
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: deleted another user like'; end if;
end $$;

reset role;
set local role anon;
do $$ begin
  if not exists(select 1 from public.posts where id = (select id from test_records where kind = 'post')) then raise exception 'FAIL: public post read'; end if;
  if not exists(select 1 from public.comments where id = (select id from test_records where kind = 'comment')) then raise exception 'FAIL: public comment read'; end if;
  begin
    insert into public.posts(body) values ('Guest write');
    raise exception 'FAIL: anonymous write allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from test_users where number = 1), true);
set local role authenticated;
do $$ declare affected integer; begin
  update public.posts set body = 'Owner edit' where id = (select id from test_records where kind = 'post');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner update'; end if;
  update public.comments set body = 'Owner edit' where id = (select id from test_records where kind = 'comment');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner comment update'; end if;
  delete from public.comments where id = (select id from test_records where kind = 'comment');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner comment delete'; end if;
  delete from public.likes where post_id = (select id from test_records where kind = 'post');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner unlike'; end if;
  delete from public.posts where id = (select id from test_records where kind = 'post');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: owner delete'; end if;
end $$;
reset role;
rollback;
select 'RLS tests passed; test content rolled back.' as result;
