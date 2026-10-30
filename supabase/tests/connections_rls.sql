-- Run as one script in SQL Editor after setup, with two registered profiles.
-- All changes are rolled back. This tests database policy enforcement.
begin;
create temporary table connection_test_users as select id, row_number() over (order by id) n from public.profiles limit 2;
grant select on connection_test_users to authenticated;
do $$ begin
 if (select count(*) from connection_test_users) <> 2 then raise exception 'Register two test accounts first.'; end if;
end $$;
-- Clear only these test pairs inside the rollback-only transaction.
delete from public.connections where follower_id in (select id from connection_test_users) and following_id in (select id from connection_test_users);
select set_config('request.jwt.claim.sub', (select id::text from connection_test_users where n = 1), true);
set local role authenticated;
insert into public.connections(follower_id, following_id) select a.id, b.id from connection_test_users a cross join connection_test_users b where a.n=1 and b.n=2;
do $$ begin
 begin
  insert into public.connections(follower_id, following_id) select a.id, b.id from connection_test_users a cross join connection_test_users b where a.n=1 and b.n=2;
  raise exception 'FAIL duplicate connection';
 exception when unique_violation then null; end;
 begin
  insert into public.connections(follower_id, following_id) select id,id from connection_test_users where n=1;
  raise exception 'FAIL self connection';
 exception when check_violation then null; end;
 begin
  insert into public.connections(follower_id, following_id) select a.id,b.id from connection_test_users a cross join connection_test_users b where a.n=2 and b.n=1;
  raise exception 'FAIL impersonated follower';
 exception when insufficient_privilege then null; end;
 begin
  update public.connections set following_id = (select id from connection_test_users where n=1);
  raise exception 'FAIL update allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from connection_test_users where n=2), true);
do $$ declare affected integer; begin
 if not exists(select 1 from public.connections where follower_id=(select id from connection_test_users where n=1) and following_id=(select id from connection_test_users where n=2)) then raise exception 'FAIL relationship read'; end if;
 delete from public.connections where follower_id=(select id from connection_test_users where n=1) and following_id=(select id from connection_test_users where n=2);
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL deleted another user connection'; end if;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from connection_test_users where n=1), true);
do $$ declare affected integer; begin
 delete from public.connections where follower_id=(select id from connection_test_users where n=1) and following_id=(select id from connection_test_users where n=2);
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'FAIL owner disconnect'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  insert into public.connections(follower_id,following_id) values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
  raise exception 'FAIL anonymous write';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Connection RLS tests passed; changes rolled back.' as result;
