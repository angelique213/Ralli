-- TEST project only, after all messaging migrations. Needs 3 registered profiles.
begin;
create temporary table visibility_users as select id,row_number() over(order by id) n from public.profiles limit 3;
grant select on visibility_users to authenticated;
do $$ begin if (select count(*) from visibility_users)<>3 then raise exception 'Need 3 test users'; end if; end $$;
select set_config('request.jwt.claim.sub',(select id::text from visibility_users where n=1),true);
set local role authenticated;
insert into public.messages(id,recipient_id,body) select 'da4736a1-37b0-4c8a-9bdb-000000000031',id,'First' from visibility_users where n=2;
insert into public.messages(id,recipient_id,body) select 'da4736a1-37b0-4c8a-9bdb-000000000032',id,'Second' from visibility_users where n=2;
select public.ralli_hide_message('da4736a1-37b0-4c8a-9bdb-000000000031');
select public.ralli_hide_message('da4736a1-37b0-4c8a-9bdb-000000000031');
do $$ begin
 if exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000031') then raise exception 'FAIL own hide'; end if;
 begin
  insert into public.message_hidden_for_users(user_id,message_id) select id,'da4736a1-37b0-4c8a-9bdb-000000000032' from visibility_users where n=2;
  raise exception 'FAIL direct hide/impersonation';
 exception when insufficient_privilege then null; end;
 begin
  update public.messages set body='edited'; raise exception 'FAIL update';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.messages; raise exception 'FAIL delete';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from visibility_users where n=2),true);
do $$ begin
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000031' and body='First') then raise exception 'FAIL other participant affected'; end if;
 if exists(select 1 from public.message_hidden_for_users where user_id<>(select auth.uid())) then raise exception 'FAIL visibility leak'; end if;
end $$;
-- Recipient can hide locally, too. Sender can still unsend the shared record.
select public.ralli_hide_message('da4736a1-37b0-4c8a-9bdb-000000000032');
select set_config('request.jwt.claim.sub',(select id::text from visibility_users where n=1),true);
select public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000032');
do $$ begin
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000032' and body is null and unsent_at is not null) then raise exception 'FAIL unsend'; end if;
end $$;
select public.ralli_hide_conversation((select id from visibility_users where n=2),'da4736a1-37b0-4c8a-9bdb-000000000041');
do $$ begin
 if exists(select 1 from public.ralli_message_inbox(0) where user_id=(select id from visibility_users where n=2)) then raise exception 'FAIL conversation still in inbox'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from visibility_users where n=2),true);
insert into public.messages(id,recipient_id,body) select 'da4736a1-37b0-4c8a-9bdb-000000000033',id,'New after deletion' from visibility_users where n=1;
select set_config('request.jwt.claim.sub',(select id::text from visibility_users where n=1),true);
-- Replay the SAME request; it must not consume the new message.
select public.ralli_hide_conversation((select id from visibility_users where n=2),'da4736a1-37b0-4c8a-9bdb-000000000041');
do $$ begin
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000033') then raise exception 'FAIL retry hid new message'; end if;
 if exists(select 1 from public.messages where id in('da4736a1-37b0-4c8a-9bdb-000000000031','da4736a1-37b0-4c8a-9bdb-000000000032')) then raise exception 'FAIL old history returned'; end if;
 if not exists(select 1 from public.ralli_message_inbox(0) where user_id=(select id from visibility_users where n=2)) then raise exception 'FAIL new conversation missing'; end if;
 begin
  perform public.ralli_hide_conversation((select id from visibility_users where n=3),'da4736a1-37b0-4c8a-9bdb-000000000041');
  raise exception 'FAIL token reuse for other conversation';
 exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from visibility_users where n=3),true);
do $$ begin
 begin
  perform public.ralli_hide_message('da4736a1-37b0-4c8a-9bdb-000000000033'); raise exception 'FAIL unrelated hide';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.ralli_hide_message('da4736a1-37b0-4c8a-9bdb-000000000033'); raise exception 'FAIL anon hide';
 exception when insufficient_privilege then null; end;
 begin
  perform public.ralli_hide_conversation('da4736a1-37b0-4c8a-9bdb-000000000033','da4736a1-37b0-4c8a-9bdb-000000000041'); raise exception 'FAIL anon conversation';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Visibility tests passed; changes rolled back.' as result;
