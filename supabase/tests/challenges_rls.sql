-- Run the entire script with two existing accounts. Everything rolls back.
begin;
create temporary table challenge_test_users as select id, row_number() over (order by id) n from public.profiles limit 2;
grant select on challenge_test_users to authenticated;
create temporary table challenge_test_ids (id uuid);
grant select, insert on challenge_test_ids to authenticated;
do $$ begin
  if (select count(*) from challenge_test_users) <> 2 then raise exception 'Register two test accounts first.'; end if;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from challenge_test_users where n=1), true);
set local role authenticated;
with added as (
  insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal)
  select id,'Policy test','Temporary test','Learning',2,'Read a page' from challenge_test_users where n=1 returning id
) insert into challenge_test_ids select id from added;
do $$ declare cid uuid; aid uuid; bid uuid; begin
  select id into cid from challenge_test_ids;
  select id into aid from challenge_test_users where n=1;
  select id into bid from challenge_test_users where n=2;
  begin
    insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal) values (bid,'Spoof','Description','Learning',2,'Read');
    raise exception 'FAIL creator spoof';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal) values (aid,E' \t\n','Description','Learning',2,'Read');
    raise exception 'FAIL blank title';
  exception when check_violation then null; end;
  begin
    insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal) values (aid,'Title','Description','Invalid',2,'Read');
    raise exception 'FAIL invalid category';
  exception when check_violation then null; end;
  begin
    insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal) values (aid,'Title','Description','Learning',366,'Read');
    raise exception 'FAIL invalid duration';
  exception when check_violation then null; end;
  begin
    insert into public.challenges(creator_id,title,description,category,duration_days,daily_goal) values (aid,'Title',repeat('x',501),'Learning',2,'Read');
    raise exception 'FAIL long description';
  exception when check_violation then null; end;
  -- Leave first: newer installations automatically join the creator.
  delete from public.challenge_participants where challenge_id=cid and user_id=aid;
  begin
    insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,aid,1);
    raise exception 'FAIL progress without participation';
  exception when foreign_key_violation then null; end;
  insert into public.challenge_participants(challenge_id,user_id) values (cid,aid) on conflict (challenge_id,user_id) do nothing;
  insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,aid,1);
  update public.challenges set title='Updated by creator' where id=cid;
  if not exists(select 1 from public.challenges where id=cid and title='Updated by creator') then raise exception 'FAIL owner edit'; end if;
  begin
    update public.challenges set duration_days=1 where id=cid;
    raise exception 'FAIL duration edit';
  exception when insufficient_privilege then null; end;
  begin
    update public.challenges set creator_id=bid where id=cid;
    raise exception 'FAIL owner change';
  exception when insufficient_privilege then null; end;
  begin
    update public.challenges set created_at=now() where id=cid;
    raise exception 'FAIL timestamp change';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.challenges where id=cid;
    raise exception 'FAIL challenge deletion';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from challenge_test_users where n=2), true);
do $$ declare cid uuid; aid uuid; bid uuid; affected integer; begin
  select id into cid from challenge_test_ids;
  select id into aid from challenge_test_users where n=1;
  select id into bid from challenge_test_users where n=2;
  if not exists(select 1 from public.challenges where id=cid) then raise exception 'FAIL other member read'; end if;
  update public.challenges set title='Unauthorized' where id=cid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL other creator edit'; end if;
  if exists(select 1 from public.challenge_progress where challenge_id=cid and user_id=aid) then raise exception 'FAIL progress privacy'; end if;
  begin
    insert into public.challenge_participants(challenge_id,user_id) values (cid,aid) on conflict (challenge_id,user_id) do nothing;
    raise exception 'FAIL join impersonation';
  exception when insufficient_privilege then null; end;
  insert into public.challenge_participants(challenge_id,user_id) values (cid,bid);
  if (select count(*) from public.challenge_participants where challenge_id=cid)<>2 then raise exception 'FAIL count'; end if;
  begin
    insert into public.challenge_participants(challenge_id,user_id) values (cid,bid);
    raise exception 'FAIL duplicate join';
  exception when unique_violation then null; end;
  begin
    insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,aid,2);
    raise exception 'FAIL progress impersonation';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,bid,3);
    raise exception 'FAIL day above duration';
  exception when check_violation then null; end;
  begin
    insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,bid,0);
    raise exception 'FAIL day zero';
  exception when check_violation then null; end;
  insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,bid,1);
  begin
    insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,bid,1);
    raise exception 'FAIL duplicate day';
  exception when unique_violation then null; end;
  begin
    update public.challenge_progress set day_number=2 where challenge_id=cid;
    raise exception 'FAIL progress update';
  exception when insufficient_privilege then null; end;
  delete from public.challenge_progress where challenge_id=cid and user_id=aid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL other user undo'; end if;
  delete from public.challenge_participants where challenge_id=cid and user_id=aid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL other user leave'; end if;
  delete from public.challenge_progress where challenge_id=cid and user_id=bid and day_number=1;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'FAIL own undo'; end if;
  insert into public.challenge_progress(challenge_id,user_id,day_number) values (cid,bid,1),(cid,bid,2);
  if (select count(*) from public.challenge_progress where challenge_id=cid)<>2 then raise exception 'FAIL completion count'; end if;
  delete from public.challenge_participants where challenge_id=cid and user_id=bid;
  if exists(select 1 from public.challenge_progress where challenge_id=cid) then raise exception 'FAIL leave cascade'; end if;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from challenge_test_users where n=1), true);
do $$ begin
  if (select count(*) from public.challenge_progress where challenge_id=(select id from challenge_test_ids))<>1 then raise exception 'FAIL owner progress changed'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.challenges;
    raise exception 'FAIL anonymous read';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.challenge_participants(challenge_id,user_id) values (gen_random_uuid(),gen_random_uuid());
    raise exception 'FAIL anonymous join';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Challenge ownership, constraints, privacy, and cascade tests passed; rolled back.' as result;
