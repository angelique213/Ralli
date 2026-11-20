-- Review and apply once in SQL Editor. Existing tables and policies are unchanged.
begin;
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  constraint messages_no_self check (sender_id <> recipient_id)
);
create index messages_sender_order on public.messages(sender_id, created_at desc, id desc);
create index messages_recipient_order on public.messages(recipient_id, created_at desc, id desc);
create index messages_pair_order on public.messages(sender_id, recipient_id, created_at desc, id desc);
alter table public.messages enable row level security;
revoke all on public.messages from public, anon, authenticated;
grant select on public.messages to authenticated;
-- Client-generated IDs allow safe retries of the same send without duplicates.
grant insert (id, recipient_id, body) on public.messages to authenticated;
create policy messages_read_participants on public.messages for select to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));
create policy messages_send_own on public.messages for insert to authenticated
with check ((select auth.uid()) = sender_id);
-- No UPDATE or DELETE permissions. Sender and timestamp are database-controlled.

-- One row per conversation, without downloading every private message into the inbox.
create function public.ralli_message_inbox(page_offset integer default 0)
returns table (user_id uuid, display_name text, avatar_path text, last_sent_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  with latest as (
    select case when sender_id = auth.uid() then recipient_id else sender_id end as other_id,
           max(created_at) as last_at
    from public.messages
    where auth.uid() in (sender_id, recipient_id)
    group by 1
  )
  select p.id, p.display_name, p.avatar_path, latest.last_at
  from latest join public.profiles p on p.id = latest.other_id
  order by latest.last_at desc, p.id
  limit 21 offset greatest(page_offset, 0);
$$;
revoke all on function public.ralli_message_inbox(integer) from public, anon;
grant execute on function public.ralli_message_inbox(integer) to authenticated;
commit;
