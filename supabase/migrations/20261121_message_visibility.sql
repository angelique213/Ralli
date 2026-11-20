-- Apply after the messaging and unsend migrations. Run manually only.
begin;
create table public.message_hidden_for_users (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index message_hidden_message on public.message_hidden_for_users(message_id);
create table public.message_visibility_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  other_user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, request_id),
  check (user_id <> other_user_id)
);
create index message_visibility_other on public.message_visibility_requests(other_user_id);
alter table public.message_hidden_for_users enable row level security;
alter table public.message_visibility_requests enable row level security;
revoke all on public.message_hidden_for_users, public.message_visibility_requests from public, anon, authenticated;
grant select on public.message_hidden_for_users, public.message_visibility_requests to authenticated;
create policy hidden_read_own on public.message_hidden_for_users for select to authenticated using (user_id = (select auth.uid()));
create policy visibility_requests_read_own on public.message_visibility_requests for select to authenticated using (user_id = (select auth.uid()));
-- This ANDs with the existing participant policy; it never broadens access.
create policy messages_hide_for_viewer on public.messages as restrictive for select to authenticated
using (not exists (select 1 from public.message_hidden_for_users h where h.user_id = (select auth.uid()) and h.message_id = messages.id));

create function public.ralli_hide_message(message_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid();
begin
  if caller is null or not exists(select 1 from public.messages m where m.id=message_id and caller in(m.sender_id,m.recipient_id)) then
    raise exception 'Message unavailable or action not allowed.' using errcode='42501';
  end if;
  insert into public.message_hidden_for_users(user_id,message_id) values(caller,message_id) on conflict do nothing;
  return pg_catalog.jsonb_build_object('id',message_id,'hidden',true);
end;
$$;
create function public.ralli_hide_conversation(other_user_id uuid, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing_other uuid;
begin
  if caller is null or other_user_id is null or request_id is null or caller=other_user_id or
    not exists(select 1 from public.profiles p where p.id=other_user_id) then
    raise exception 'Conversation unavailable or action not allowed.' using errcode='42501';
  end if;
  -- Concurrent retries serialize on the request's unique key. Everything commits together.
  insert into public.message_visibility_requests(user_id,request_id,other_user_id)
    values(caller,request_id,other_user_id) on conflict do nothing;
  if not found then
    select r.other_user_id into existing_other from public.message_visibility_requests r
      where r.user_id=caller and r.request_id=ralli_hide_conversation.request_id;
    if existing_other is distinct from other_user_id then
      raise exception 'Request belongs to a different conversation.' using errcode='22023';
    end if;
    return pg_catalog.jsonb_build_object('other_user_id',other_user_id,'request_id',request_id,'hidden',true);
  end if;
  -- Hide the full conversation visible to this statement, not just the loaded page.
  -- Messages committed after this snapshot remain visible.
  insert into public.message_hidden_for_users(user_id,message_id)
    select caller,m.id from public.messages m
    where (m.sender_id=caller and m.recipient_id=other_user_id) or (m.sender_id=other_user_id and m.recipient_id=caller)
    on conflict do nothing;
  return pg_catalog.jsonb_build_object('other_user_id',other_user_id,'request_id',request_id,'hidden',true);
end;
$$;
revoke all on function public.ralli_hide_message(uuid), public.ralli_hide_conversation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ralli_hide_message(uuid), public.ralli_hide_conversation(uuid,uuid) to authenticated;
-- Existing message grants, sender-only unsend, and SECURITY INVOKER inbox stay intact.
commit;
