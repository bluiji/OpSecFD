-- =====================================================================
-- OpSec for Dummies — Supabase schema
-- Run the whole file in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Safe to re-run: tables use IF NOT EXISTS, policies are dropped and
-- recreated, and seed rows use ON CONFLICT DO NOTHING (admin edits are kept).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text,
  email       text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now()
);

create table if not exists public.modules (
  id             serial primary key,
  module_number  int unique not null,
  title          text not null,
  difficulty     text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  description    text
);

create table if not exists public.lessons (
  id                   serial primary key,
  module_id            int not null references public.modules (id) on delete cascade,
  lesson_order         int not null,
  title                text not null,
  what_is_it           text,
  why_it_matters       text,
  how_it_works         text,
  real_world_scenario  text,
  how_to_protect       text,
  quiz_json            jsonb not null default '[]'::jsonb
                         check (jsonb_typeof(quiz_json) = 'array'),
  unique (module_id, lesson_order)
);

create table if not exists public.user_progress (
  id            serial primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     int  not null references public.lessons (id) on delete cascade,
  completed     boolean not null default true,
  quiz_score    int check (quiz_score between 0 and 100),
  completed_at  timestamptz default now(),
  unique (user_id, lesson_id)
);

-- One row per user, checklist item, and stage.
--   'baseline' = "Before you start" audit, locked once saved.
--   'final'    = re-evaluation after finishing all modules.
create table if not exists public.user_checklists (
  id          serial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  stage       text not null default 'baseline' check (stage in ('baseline', 'final')),
  item_key    text not null,
  is_checked  boolean not null default false,
  updated_at  timestamptz not null default now(),
  constraint user_checklists_user_stage_item_key unique (user_id, stage, item_key)
);

-- Upgrade path for databases created before checklist stages existed:
-- existing rows become the user's baseline.
alter table public.user_checklists
  add column if not exists stage text not null default 'baseline';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_checklists_stage_check') then
    alter table public.user_checklists
      add constraint user_checklists_stage_check check (stage in ('baseline', 'final'));
  end if;
  alter table public.user_checklists drop constraint if exists user_checklists_user_id_item_key_key;
  if not exists (select 1 from pg_constraint where conname = 'user_checklists_user_stage_item_key') then
    alter table public.user_checklists
      add constraint user_checklists_user_stage_item_key unique (user_id, stage, item_key);
  end if;
end $$;

-- When each stage was saved, and the score (items checked) at that moment.
create table if not exists public.user_checklist_status (
  user_id                uuid primary key references public.profiles (id) on delete cascade,
  baseline_completed_at  timestamptz,
  baseline_score         int check (baseline_score >= 0),
  final_completed_at     timestamptz,
  final_score            int check (final_score >= 0),
  total_items            int check (total_items > 0),
  updated_at             timestamptz not null default now()
);

create table if not exists public.daily_tips (
  id        serial primary key,
  tip_text  text not null unique,
  category  text
);

-- Myths vs. facts shown inside each module: [{ "myth": "...", "fact": "..." }]
alter table public.modules
  add column if not exists myths_json jsonb not null default '[]'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'modules_myths_json_is_array') then
    alter table public.modules
      add constraint modules_myths_json_is_array check (jsonb_typeof(myths_json) = 'array');
  end if;
end $$;

-- Real-world incidents for the Reference Hub.
-- links_json: [{ "label": "...", "url": "https://..." }]
create table if not exists public.case_studies (
  id          serial primary key,
  sort_order  int not null default 0,
  title       text not null unique,
  summary     text not null,
  failure     text not null,
  lesson      text not null,
  links_json  jsonb not null default '[]'::jsonb check (jsonb_typeof(links_json) = 'array')
);

-- The glossary was removed from the app. The table is left in place on
-- existing databases so no data is lost; drop it yourself if you want:
--   drop table if exists public.glossary_terms;

create index if not exists lessons_module_idx        on public.lessons (module_id, lesson_order);
create index if not exists user_progress_lesson_idx  on public.user_progress (lesson_id);

-- ---------------------------------------------------------------------
-- 2. HELPER: is_admin()
-- SECURITY DEFINER so policies can check the caller's role without
-- recursively triggering RLS on profiles.
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 3. TRIGGER: create a profile for every new auth user
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1)),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. TRIGGER: block privilege escalation on profiles
-- RLS lets a user UPDATE their own row, which would otherwise include
-- the role column. This guard only lets admins (or the service role /
-- SQL editor, where auth.uid() is null) change role, id, or email.
-- ---------------------------------------------------------------------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;  -- service role, SQL editor, or an admin
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'id and email cannot be changed here' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------
-- 4b. TRIGGERS: keep a saved checklist baseline fixed
-- Once a user saves their "Before you start" baseline, its items and
-- score can't be changed, so before/after comparisons stay meaningful.
-- The service role / SQL editor (auth.uid() is null) can still fix data.
-- ---------------------------------------------------------------------

create or replace function public.guard_checklist_baseline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or new.stage <> 'baseline' then
    return new;
  end if;
  if exists (
    select 1 from public.user_checklist_status s
    where s.user_id = new.user_id and s.baseline_completed_at is not null
  ) then
    raise exception 'Your baseline is already saved and cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_checklist_baseline on public.user_checklists;
create trigger guard_checklist_baseline
  before insert or update on public.user_checklists
  for each row execute function public.guard_checklist_baseline();

create or replace function public.guard_checklist_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.baseline_completed_at is not null and (
       new.baseline_completed_at is distinct from old.baseline_completed_at
       or new.baseline_score is distinct from old.baseline_score) then
    raise exception 'Your baseline is already saved and cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_checklist_status on public.user_checklist_status;
create trigger guard_checklist_status
  before update on public.user_checklist_status
  for each row execute function public.guard_checklist_status();

-- ---------------------------------------------------------------------
-- 4c. lesson_quiz(): quiz questions and options WITHOUT answers or explanations
-- Signed-in users can't read lessons.quiz_json (see GRANTS), so the lesson
-- page calls this instead. Answers are revealed by /api/quiz/submit only
-- after an attempt.
-- ---------------------------------------------------------------------

create or replace function public.lesson_quiz(p_lesson_id int)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $
  select coalesce(
    jsonb_agg(jsonb_build_object('question', q.value -> 'question', 'options', q.value -> 'options') order by q.ordinality),
    '[]'::jsonb)
  from public.lessons l
  cross join lateral jsonb_array_elements(l.quiz_json) with ordinality as q(value, ordinality)
  where l.id = p_lesson_id
    and auth.uid() is not null;
$;

revoke all on function public.lesson_quiz(int) from public, anon;
grant execute on function public.lesson_quiz(int) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.user_progress   enable row level security;
alter table public.user_checklists enable row level security;
alter table public.daily_tips      enable row level security;
alter table public.case_studies    enable row level security;
alter table public.user_checklist_status enable row level security;

-- Content tables: any signed-in user reads, only admins write.
do $$
declare t text;
begin
  foreach t in array array['modules', 'lessons', 'daily_tips', 'case_studies'] loop
    execute format('drop policy if exists "%1$s_select_authenticated" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_admin" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_admin" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete_admin" on public.%1$I', t);

    execute format('create policy "%1$s_select_authenticated" on public.%1$I
                      for select to authenticated using (true)', t);
    execute format('create policy "%1$s_insert_admin" on public.%1$I
                      for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "%1$s_update_admin" on public.%1$I
                      for update to authenticated using ((select public.is_admin()))
                      with check ((select public.is_admin()))', t);
    execute format('create policy "%1$s_delete_admin" on public.%1$I
                      for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- Per-user tables: own rows only; admins may read everything.
-- user_progress is read-only for users: quiz scores are written only by
-- /api/quiz/submit (service role) after grading on the server.
do $
declare t text;
begin
  foreach t in array array['user_progress', 'user_checklists', 'user_checklist_status'] loop
    execute format('drop policy if exists "%1$s_select_own_or_admin" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);

    execute format('create policy "%1$s_select_own_or_admin" on public.%1$I
                      for select to authenticated
                      using ((select auth.uid()) = user_id or (select public.is_admin()))', t);
    continue when t = 'user_progress';
    execute format('create policy "%1$s_insert_own" on public.%1$I
                      for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$I
                      for update to authenticated
                      using ((select auth.uid()) = user_id)
                      with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Case studies are public teaching material, also shown to signed-out visitors.
drop policy if exists "case_studies_select_anon" on public.case_studies;
create policy "case_studies_select_anon" on public.case_studies
  for select to anon using (true);

-- Profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own"          on public.profiles;
drop policy if exists "profiles_update_admin"        on public.profiles;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);   -- role changes blocked by guard_profile_update

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 6. GRANTS (explicit, so the app works even if default grants differ)
-- anon can only read case_studies; every other table requires a signed-in user.
-- ---------------------------------------------------------------------

revoke all on public.profiles, public.modules, public.lessons, public.user_progress,
              public.user_checklists, public.user_checklist_status, public.daily_tips,
              public.case_studies from anon;
grant select on public.case_studies to anon;

grant select, update                 on public.profiles        to authenticated;
grant select, insert, update, delete on public.modules         to authenticated;
-- lessons: every column except quiz_json (it holds the answer keys).
-- Questions come from public.lesson_quiz(); grading happens in /api/quiz/submit.
revoke select on public.lessons from authenticated;
grant select (id, module_id, lesson_order, title, what_is_it, why_it_matters,
              how_it_works, real_world_scenario, how_to_protect)
                                     on public.lessons         to authenticated;
grant insert, update, delete         on public.lessons         to authenticated;
grant select, insert, update, delete on public.daily_tips      to authenticated;
grant select, insert, update, delete on public.case_studies    to authenticated;
revoke insert, update, delete        on public.user_progress   from authenticated;
grant select                         on public.user_progress   to authenticated;
grant select, insert, update         on public.user_checklists to authenticated;
grant select, insert, update         on public.user_checklist_status to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The API routes use the service role (bypasses RLS). Supabase grants this by
-- default; it's repeated here so the quiz API works even if defaults differ.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------
-- 7. REALTIME for the checklist (skipped if the publication is missing)
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_checklists'
     ) then
    alter publication supabase_realtime add table public.user_checklists;
  end if;
end $$;
