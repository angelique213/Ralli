-- Run after both challenge migrations with two registered accounts. Rolls back.
begin;
create temporary table creator_test_users as select id, row_number() over(order by id) n from public.profiles limit 2;
create temporary table creator_test_challenge(id uuid);
grant select on creator_test_users to authenticated;
grant select, insert on creator_test_challenge to authenticated;
do $$ begin
  if (select count(*) from creator_test_users) <> 2 then raise exception 'Two accounts are required.'; end if;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from creator_test_users where n=1), true);
set local role authenticated;
with added as (
 insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal)
 select id,'Automatic membership test','Rolled back','Learning',2,'Read' from creator_test_users where n=1 returning id
) insert into creator_test_challenge select id from added;
do $$ declare cid uuid; aid uuid; begin
 select id into cid from creator_test_challenge;
 select id into aid from creator_test_users where n=1;
 if (select count(*) from public.challenge_participants where challenge_id=cid and user_id=aid)<>1 then raise exception 'FAIL creator not joined exactly once'; end if;
 insert into public.challenge_progress(challenge_id,user_id,day_number) values(cid,aid,1);
 begin
  insert into public.challenge_participants(challenge_id,user_id) values(cid,aid);
  raise exception 'FAIL duplicate join';
 exception when unique_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from creator_test_users where n=2), true);
insert into public.challenge_participants(challenge_id,user_id) select c.id,u.id from creator_test_challenge c cross join creator_test_users u where u.n=2;
insert into public.challenge_progress(challenge_id,user_id,day_number) select c.id,u.id,1 from creator_test_challenge c cross join creator_test_users u where u.n=2;
do $$ begin
 begin
  insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal)
  select id,'Impersonation test','Rejected','Learning',2,'Read' from creator_test_users where n=1;
  raise exception 'FAIL spoofed creator';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from creator_test_users where n=1), true);
delete from public.challenge_participants where challenge_id=(select id from creator_test_challenge) and user_id=(select id from creator_test_users where n=1);
update public.challenges set title='Edit after leaving' where id=(select id from creator_test_challenge);
do $$ begin
 if exists(select 1 from public.challenge_participants where challenge_id=(select id from creator_test_challenge) and user_id=(select id from creator_test_users where n=1)) then raise exception 'FAIL creator rejoined on edit'; end if;
 if exists(select 1 from public.challenge_progress where challenge_id=(select id from creator_test_challenge)) then raise exception 'FAIL own progress not removed'; end if;
end $$;
insert into public.challenge_participants(challenge_id,user_id) select c.id,u.id from creator_test_challenge c cross join creator_test_users u where u.n=1;
select set_config('request.jwt.claim.sub', (select id::text from creator_test_users where n=2), true);
do $$ begin
 if (select count(*) from public.challenge_progress where challenge_id=(select id from creator_test_challenge))<>1 then raise exception 'FAIL other member progress changed'; end if;
end $$;
reset role;
-- Proves the trigger obeys participant RLS and a failed join rolls back creation.
create policy creator_test_deny_join on public.challenge_participants as restrictive for insert to authenticated with check(false);
set local role authenticated;
do $$ begin
 begin
  insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal)
  select id,'Must roll back with join','Rejected','Learning',2,'Read' from creator_test_users where n=2;
  raise exception 'FAIL join bypassed RLS';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.challenges where title='Must roll back with join') then raise exception 'FAIL partial creation'; end if;
end $$;
reset role;
rollback;
select 'Creator join, duplicate prevention, leave/edit/rejoin, RLS, and atomicity passed; rolled back.' as result;
