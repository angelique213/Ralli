-- Apply manually after 20261121_message_visibility.sql. No message bodies are copied.
begin;
alter table public.messages add column reply_to_message_id uuid;
alter table public.messages add constraint messages_reply_to_message_id_fkey
  foreign key (reply_to_message_id) references public.messages(id) on delete set null;
alter table public.messages add constraint messages_reply_not_self
  check (reply_to_message_id is null or reply_to_message_id <> id);
create index messages_reply_target on public.messages(reply_to_message_id)
  where reply_to_message_id is not null;
grant insert (reply_to_message_id) on public.messages to authenticated;

-- Run as the caller so participant AND per-user visibility policies still apply.
create function public.ralli_validate_message_reply() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.reply_to_message_id is not null then
    if auth.uid() is null or new.sender_id <> auth.uid() or not exists (
      select 1 from public.messages original
      where original.id = new.reply_to_message_id and original.unsent_at is null
      and ((original.sender_id = new.sender_id and original.recipient_id = new.recipient_id)
        or (original.sender_id = new.recipient_id and original.recipient_id = new.sender_id))
    ) then
      raise exception 'Reply target unavailable.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.ralli_validate_message_reply() from public, anon, authenticated;
create trigger messages_validate_reply before insert on public.messages
  for each row execute function public.ralli_validate_message_reply();
-- No new SELECT policies, UPDATE/DELETE grants, or changes to existing functions.
-- Reply previews must use normal RLS-protected SELECT queries, never stored snapshots.
commit;
