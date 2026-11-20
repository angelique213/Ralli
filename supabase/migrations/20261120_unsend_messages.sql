-- Apply AFTER 20261119_private_messages.sql. Review before running manually.
begin;
-- Stop if the expected original constraint is missing; do not guess another name.
do $$ begin
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.messages'::regclass and conname = 'messages_body_check' and contype = 'c') then
    raise exception 'Expected messages_body_check missing. Review the deployed schema before proceeding.';
  end if;
end $$;
alter table public.messages add column unsent_at timestamptz;
alter table public.messages alter column body drop not null;
alter table public.messages drop constraint messages_body_check;
alter table public.messages add constraint messages_body_state_check check (
  (unsent_at is null and body is not null and char_length(body) between 1 and 2000 and body ~ '[^[:space:]]')
  or (unsent_at is not null and body is null)
);
-- Existing SELECT/INSERT policies and column grants remain unchanged.
-- No UPDATE/DELETE grant or client INSERT permission on unsent_at is added.
create function public.ralli_unsend_message(message_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  saved_time timestamptz;
begin
  if caller is null then
    raise exception 'Message unavailable or action not allowed.' using errcode = '42501';
  end if;
  -- Lock only the caller's message. Concurrent retries keep the first timestamp.
  select m.unsent_at into saved_time from public.messages m
    where m.id = message_id and m.sender_id = caller for update;
  if not found then
    raise exception 'Message unavailable or action not allowed.' using errcode = '42501';
  end if;
  if saved_time is null then
    update public.messages m set body = null, unsent_at = pg_catalog.clock_timestamp()
      where m.id = message_id and m.sender_id = caller
      returning m.unsent_at into saved_time;
  end if;
  return pg_catalog.jsonb_build_object('id', message_id, 'unsent_at', saved_time);
end;
$$;
revoke all on function public.ralli_unsend_message(uuid) from public, anon, authenticated;
grant execute on function public.ralli_unsend_message(uuid) to authenticated;
commit;
