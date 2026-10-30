-- Run the whole file after setup with at least two registered accounts.
-- This tests SQL policies, not image bytes or Storage API size/type enforcement.
begin;
create temporary table profile_test_users as select id, row_number() over (order by id) n from public.profiles limit 2;
grant select on profile_test_users to authenticated;
do $$ begin
  if (select count(*) from profile_test_users) <> 2 then raise exception 'Two accounts are required.'; end if;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from profile_test_users where n = 1), true);
set local role authenticated;
do $$ declare affected integer; own_id uuid; other_id uuid; begin
  select id into own_id from profile_test_users where n = 1;
  select id into other_id from profile_test_users where n = 2;
  update public.profiles set display_name = 'Temporary policy test', bio = 'Rolled back' where id = own_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: own profile update'; end if;
  update public.profiles set bio = 'Unauthorized' where id = other_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: other profile updated'; end if;
  begin
    update public.profiles set avatar_path = other_id::text || '/avatar/test.png' where id = own_id;
    raise exception 'FAIL: another account image reference accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set bio = repeat('x', 301) where id = own_id;
    raise exception 'FAIL: oversized bio accepted';
  exception when check_violation then null; end;
  begin
    insert into storage.objects(bucket_id, name) values ('ralli-profile-images', other_id::text || '/avatar/rls-test.png');
    raise exception 'FAIL: upload into another account folder allowed';
  exception when insufficient_privilege then null; end;
  insert into storage.objects(bucket_id, name) values ('ralli-profile-images', own_id::text || '/avatar/rls-test-' || gen_random_uuid()::text || '.png');
end $$;
reset role;
rollback;
select 'Profile RLS tests passed; all test changes rolled back.' as result;
