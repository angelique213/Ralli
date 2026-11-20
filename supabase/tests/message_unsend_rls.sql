-- Test project only: requires the messaging + unsend migrations and 3 profiles.
-- Run the entire script; all test writes roll back.
begin;
create temporary table unsend_users as select id,row_number() over(order by id) n from public.profiles limit 3;
grant select on unsend_users to authenticated;
create temporary table unsend_result (value jsonb);
grant select,insert on unsend_result to authenticated;
do $$ begin
 if (select count(*) from unsend_users) <> 3 then raise exception 'Need three test accounts'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from unsend_users where n=1),true);
set local role authenticated;
insert into public.messages(id,recipient_id,body) select 'da4736a1-37b0-4c8a-9bdb-000000000021',id,'Must disappear' from unsend_users where n=2;
-- Recipient and unrelated user cannot use the privileged operation.
select set_config('request.jwt.claim.sub',(select id::text from unsend_users where n=2),true);
do $$ begin
 begin
  perform public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000021');
  raise exception 'FAIL recipient unsend';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from unsend_users where n=3),true);
do $$ begin
 begin
  perform public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000021');
  raise exception 'FAIL unrelated unsend';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from unsend_users where n=1),true);
insert into unsend_result select public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000021');
do $$ begin
 if public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000021') <> (select value from unsend_result) then raise exception 'FAIL retry changed result'; end if;
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000021' and body is null and unsent_at is not null and created_at=now()) then raise exception 'FAIL unsent record'; end if;
 begin
  update public.messages set body='restore',unsent_at=null where id='da4736a1-37b0-4c8a-9bdb-000000000021';
  raise exception 'FAIL direct update';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000021';
  raise exception 'FAIL delete';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(recipient_id,body,unsent_at) select id,null,now() from unsend_users where n=2;
  raise exception 'FAIL forged unsent insert';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(recipient_id,body) select id,null from unsend_users where n=2;
  raise exception 'FAIL null new message';
 exception when check_violation then null; end;
 begin
  perform public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000099');
  raise exception 'FAIL nonexistent message';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from unsend_users where n=2),true);
do $$ begin
 if not exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000021' and body is null and unsent_at is not null) then raise exception 'FAIL recipient sees original'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from unsend_users where n=3),true);
do $$ begin
 if exists(select 1 from public.messages where id='da4736a1-37b0-4c8a-9bdb-000000000021') then raise exception 'FAIL privacy'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.ralli_unsend_message('da4736a1-37b0-4c8a-9bdb-000000000021');
  raise exception 'FAIL anonymous unsend';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Unsend authorization tests passed; changes rolled back.' as result;
