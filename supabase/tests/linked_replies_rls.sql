-- TEST PROJECT ONLY, after all four messaging migrations. Requires three profiles.
-- Run the whole script. All writes roll back. This script has NOT been executed.
begin;
create temporary table reply_users as select id,row_number() over(order by id) n from public.profiles limit 3;
grant select on reply_users to authenticated;
do $$ begin
 if (select count(*) from reply_users) <> 3 then raise exception 'Need three test accounts'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from reply_users where n=1),true);
set local role authenticated;
insert into public.messages(id,recipient_id,body)
 select 'da4736a1-37b0-4c8a-9bdb-000000000031',id,'Original private text' from reply_users where n=2;
-- Reject references into a different conversation even when the sender can read it.
do $$ begin
 begin
  insert into public.messages(recipient_id,body,reply_to_message_id)
   select id,'wrong conversation','da4736a1-37b0-4c8a-9bdb-000000000031' from reply_users where n=3;
  raise exception 'FAIL cross-conversation reference';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from reply_users where n=2),true);
insert into public.messages(id,recipient_id,body,reply_to_message_id)
 select 'da4736a1-37b0-4c8a-9bdb-000000000032',id,'yes','da4736a1-37b0-4c8a-9bdb-000000000031' from reply_users where n=1;
select public.ralli_hide_message('da4736a1-37b0-4c8a-9bdb-000000000031');
do $$ begin
 if not exists (
  select 1 from public.messages reply left join public.messages original on original.id=reply.reply_to_message_id
  where reply.id='da4736a1-37b0-4c8a-9bdb-000000000032' and reply.body='yes' and original.id is null
 ) then raise exception 'FAIL hidden preview leaked or reply lost'; end if;
 begin
  insert into public.messages(recipient_id,body,reply_to_message_id)
   select id,'hidden target','da4736a1-37b0-4c8a-9bdb-000000000031' from reply_users where n=1;
  raise exception 'FAIL hidden target accepted';
 exception when insufficient_privilege then null; end;
 begin
  update public.messages set reply_to_message_id=null where id='da4736a1-37b0-4c8a-9bdb-000000000032';
  raise exception 'FAIL direct update';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from reply_users where n=1),true);
do $$ begin
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000031' and body='Original private text') then
  raise exception 'FAIL hiding affected other participant'; end if;
end $$;
select public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000031');
do $$ begin
 if not exists (
  select 1 from public.messages reply join public.messages original on original.id=reply.reply_to_message_id
  where reply.id='da4736a1-37b0-4c8a-9bdb-000000000032' and original.body is null and original.unsent_at is not null
 ) then raise exception 'FAIL unsent preview'; end if;
 begin
  insert into public.messages(recipient_id,body,reply_to_message_id)
   select id,'unsent target','da4736a1-37b0-4c8a-9bdb-000000000031' from reply_users where n=2;
  raise exception 'FAIL unsent target accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from reply_users where n=3),true);
do $$ begin
 if exists(select 1 from public.messages where id in ('da4736a1-37b0-4c8a-9bdb-000000000031','da4736a1-37b0-4c8a-9bdb-000000000032')) then
  raise exception 'FAIL unrelated reader'; end if;
 begin
  insert into public.messages(recipient_id,body,reply_to_message_id)
   select id,'unauthorized target','da4736a1-37b0-4c8a-9bdb-000000000031' from reply_users where n=1;
  raise exception 'FAIL unrelated reference';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform id from public.messages limit 1;
  raise exception 'FAIL anonymous read';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
