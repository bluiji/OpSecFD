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

create table if not exists public.user_checklists (
  id          serial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_key    text not null,
  is_checked  boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (user_id, item_key)
);

create table if not exists public.daily_tips (
  id        serial primary key,
  tip_text  text not null unique,
  category  text
);

create table if not exists public.glossary_terms (
  id          serial primary key,
  term        text not null unique,
  definition  text not null,
  category    text
);

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
-- 5. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.user_progress   enable row level security;
alter table public.user_checklists enable row level security;
alter table public.daily_tips      enable row level security;
alter table public.glossary_terms  enable row level security;

-- Content tables: any signed-in user reads, only admins write.
do $$
declare t text;
begin
  foreach t in array array['modules', 'lessons', 'daily_tips', 'glossary_terms'] loop
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
do $$
declare t text;
begin
  foreach t in array array['user_progress', 'user_checklists'] loop
    execute format('drop policy if exists "%1$s_select_own_or_admin" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);

    execute format('create policy "%1$s_select_own_or_admin" on public.%1$I
                      for select to authenticated
                      using ((select auth.uid()) = user_id or (select public.is_admin()))', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I
                      for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$I
                      for update to authenticated
                      using ((select auth.uid()) = user_id)
                      with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

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
-- anon gets nothing: every table requires a signed-in user.
-- ---------------------------------------------------------------------

revoke all on public.profiles, public.modules, public.lessons, public.user_progress,
              public.user_checklists, public.daily_tips, public.glossary_terms from anon;

grant select, update                 on public.profiles        to authenticated;
grant select, insert, update, delete on public.modules         to authenticated;
grant select, insert, update, delete on public.lessons         to authenticated;
grant select, insert, update, delete on public.daily_tips      to authenticated;
grant select, insert, update, delete on public.glossary_terms  to authenticated;
grant select, insert, update         on public.user_progress   to authenticated;
grant select, insert, update         on public.user_checklists to authenticated;
grant usage, select on all sequences in schema public to authenticated;

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
