-- Apply once AFTER 20261106_challenges.sql. Existing memberships are untouched.
begin;

-- Runs with the inserting user's permissions; existing RLS still applies.
create function public.ralli_join_challenge_creator() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.challenge_participants (challenge_id, user_id)
  values (new.id, new.creator_id)
  on conflict (challenge_id, user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.ralli_join_challenge_creator() from public, anon, authenticated;

-- Both inserts succeed together, or neither is saved. No UPDATE trigger/backfill.
create trigger challenge_creator_participation
  after insert on public.challenges
  for each row execute function public.ralli_join_challenge_creator();
commit;
