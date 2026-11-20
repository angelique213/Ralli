-- Run on a test project after the migration with THREE registered test accounts.
-- Everything inserted here rolls back. Never use service-role calls to test client access.
begin;
create temporary table message_test_users as
select id, row_number() over(order by id) n from public.profiles limit 3;
grant select on message_test_users to authenticated;
do $$ begin
 if (select count(*) from message_test_users) <> 3 then raise exception 'Create three test accounts first'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from message_test_users where n=1),true);
set local role authenticated;
insert into public.messages(id,recipient_id,body) values
('da4736a1-37b0-4c8a-9bdb-000000000011',(select id from message_test_users where n=2),'Private test message');
do $$ begin
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000011' and sender_id=auth.uid()) then raise exception 'Sender read/default failed'; end if;
 begin
  insert into public.messages(sender_id,recipient_id,body) select b.id,a.id,'forged' from message_test_users a,message_test_users b where a.n=1 and b.n=2;
  raise exception 'FAIL impersonation';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(recipient_id,body) values(auth.uid(),'self');
  raise exception 'FAIL self message';
 exception when check_violation then null; end;
 begin
  insert into public.messages(recipient_id,body) select id,E' \n\t ' from message_test_users where n=2;
  raise exception 'FAIL blank';
 exception when check_violation then null; end;
 begin
  insert into public.messages(recipient_id,body) select id,repeat('x',2001) from message_test_users where n=2;
  raise exception 'FAIL oversized';
 exception when check_violation then null; end;
 begin
  update public.messages set body='changed' where id='da4736a1-37b0-4c8a-9bdb-000000000011';
  raise exception 'FAIL update';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000011';
  raise exception 'FAIL delete';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from message_test_users where n=2),true);
do $$ begin
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000011') then raise exception 'Recipient cannot read'; end if;
end $$;
insert into public.messages(recipient_id,body) select id,'Reply' from message_test_users where n=1;
select set_config('request.jwt.claim.sub',(select id::text from message_test_users where n=3),true);
do $$ begin
 if exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000011') then raise exception 'FAIL third-party read'; end if;
 if exists(select 1 from public.ralli_message_inbox() inbox where not exists (
   select 1 from public.messages m where
   (m.sender_id=auth.uid() and m.recipient_id=inbox.user_id) or
   (m.recipient_id=auth.uid() and m.sender_id=inbox.user_id))) then
   raise exception 'FAIL inbox leaked another conversation'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform 1 from public.messages;
  raise exception 'FAIL anonymous read';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(recipient_id,body) values('da4736a1-37b0-4c8a-9bdb-000000000012','anonymous');
  raise exception 'FAIL anonymous send';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Messaging RLS tests passed; test changes rolled back.' as result;
