-- Apply once in SQL Editor. This migration only adds challenge resources.
begin;
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100 and title ~ '[^[:space:]]'),
  description text not null check (char_length(description) between 1 and 500 and description ~ '[^[:space:]]'),
  category text not null check (category in ('Fitness','Learning','Wellness','Creativity','Personal Growth','Other')),
  duration_days integer not null check (duration_days between 1 and 365),
  daily_goal text not null check (char_length(daily_goal) between 1 and 300 and daily_goal ~ '[^[:space:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create table public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null,
  user_id uuid not null default auth.uid(),
  day_number integer not null check (day_number between 1 and 365),
  completed_at timestamptz not null default now(),
  unique (challenge_id, user_id, day_number),
  foreign key (challenge_id, user_id) references public.challenge_participants(challenge_id, user_id) on delete cascade
);
create index challenges_newest on public.challenges(created_at desc, id desc);
create index challenges_creator on public.challenges(creator_id, created_at desc, id desc);
create index challenge_participants_user on public.challenge_participants(user_id, challenge_id);
create index challenge_progress_user on public.challenge_progress(user_id, challenge_id);

-- Duration is fixed in version one, so saved days cannot become invalid.
create function public.ralli_guard_challenge() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.creator_id is distinct from old.creator_id
     or new.created_at is distinct from old.created_at or new.duration_days is distinct from old.duration_days then
    raise exception 'Challenge owner, ID, creation time, and duration cannot change.' using errcode = '23514';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger challenge_edit_guard before update on public.challenges
for each row execute function public.ralli_guard_challenge();

create function public.ralli_check_challenge_day() returns trigger
language plpgsql set search_path = '' as $$
declare duration integer;
begin
  select duration_days into duration from public.challenges where id = new.challenge_id;
  if duration is null or new.day_number < 1 or new.day_number > duration then
    raise exception 'Day must be within the challenge duration.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger challenge_day_guard before insert or update on public.challenge_progress
for each row execute function public.ralli_check_challenge_day();
revoke all on function public.ralli_guard_challenge(), public.ralli_check_challenge_day() from public, anon, authenticated;

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_progress enable row level security;
revoke all on public.challenges, public.challenge_participants, public.challenge_progress from public, anon, authenticated;
grant select on public.challenges, public.challenge_participants, public.challenge_progress to authenticated;
grant insert (creator_id,title,description,category,duration_days,daily_goal) on public.challenges to authenticated;
grant update (title,description,category,daily_goal) on public.challenges to authenticated;
grant insert (challenge_id,user_id) on public.challenge_participants to authenticated;
grant delete on public.challenge_participants to authenticated;
grant insert (challenge_id,user_id,day_number) on public.challenge_progress to authenticated;
grant delete on public.challenge_progress to authenticated;

create policy challenges_read on public.challenges for select to authenticated using (true);
create policy challenges_create on public.challenges for insert to authenticated with check ((select auth.uid()) = creator_id);
create policy challenges_edit on public.challenges for update to authenticated
using ((select auth.uid()) = creator_id) with check ((select auth.uid()) = creator_id);
-- Membership is visible to members for participant counts. Progress stays private.
create policy challenge_participants_read on public.challenge_participants for select to authenticated using (true);
create policy challenge_participants_join on public.challenge_participants for insert to authenticated with check ((select auth.uid()) = user_id);
create policy challenge_participants_leave on public.challenge_participants for delete to authenticated using ((select auth.uid()) = user_id);
create policy challenge_progress_read on public.challenge_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy challenge_progress_add on public.challenge_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy challenge_progress_undo on public.challenge_progress for delete to authenticated using ((select auth.uid()) = user_id);
-- No challenge DELETE or participant/progress UPDATE privileges are granted.
commit;
