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

-- =====================================================================
-- 8. SEED DATA (generated by scripts/build-schema.mjs — edit the files in supabase/seed/)
-- =====================================================================

insert into public.modules (module_number, title, difficulty, description) values
  (1, 'Introduction to Operational Security', 'Beginner', 'What OpSec is, why it matters, the five-step OpSec process, threats vs. vulnerabilities vs. risks, and your digital footprint.'),
  (2, 'Social Engineering & Human Threats', 'Beginner', 'Phishing, smishing, pretexting, impersonation, manipulation tactics, and how to avoid online scams.'),
  (3, 'Account & Identity Security', 'Beginner', 'Strong passwords, password managers, MFA, secure account recovery, credential attacks, and protecting your identity.'),
  (4, 'Device & System Security', 'Intermediate', 'Updates, malware types, endpoint protection, disk encryption, USB safety, secure configuration, and physical security.'),
  (5, 'Network & Internet Security', 'Intermediate', 'How the internet works, public Wi-Fi, VPNs, DNS and HTTPS, router security, MITM attacks, and firewalls.'),
  (6, 'Digital Privacy & Anonymity', 'Intermediate', 'Fingerprinting, cookies, search privacy, metadata, location sharing, social media privacy, and anonymity myths.'),
  (7, 'Practical Operational Security', 'Advanced', 'Threat modeling, risk assessment, compartmentalization, need-to-know, classification, secure communication, and case studies.'),
  (8, 'Incident Response & Recovery', 'Advanced', 'Recognizing compromise, breach response, cleaning devices, account recovery, backups, reporting cybercrime, and your checklist.')
on conflict (module_number) do nothing;

-- Mythbusters per module (only where none are set yet)
update public.modules set myths_json = '[{"myth":"I''m not important enough to be hacked.","fact":"Many attacks are automated and target anyone reachable. Mass phishing and credential stuffing don''t pick victims by importance; your email, money, and contacts are worth something to a scammer."},{"myth":"OpSec is only for spies, soldiers, and journalists.","fact":"OpSec is a simple habit: know what to protect, who might want it, and how it could leak. The same thinking protects your bank account, your home address, and your family."},{"myth":"I have nothing to hide, so privacy doesn''t matter.","fact":"Privacy isn''t about hiding wrongdoing. Your birthday, address, and pet''s name can be enough to guess security answers, reset accounts, or impersonate you."}]'::jsonb where module_number = 1 and myths_json = '[]'::jsonb;
update public.modules set myths_json = '[{"myth":"Only gullible people fall for scams.","fact":"Social engineering works by creating urgency, fear, or trust, and it catches smart, busy people every day. A pause-and-verify habit matters more than intelligence."},{"myth":"A message from a friend or family member is safe.","fact":"Accounts get hijacked and names are easy to fake. If a ''friend'' suddenly asks for money, codes, or a link click, confirm through a different channel, such as calling them."},{"myth":"My bank may call and ask for my OTP to verify me.","fact":"Banks and e-wallets do not ask you to read out a one-time code. Anyone asking for it is trying to log in as you. Hang up and call the number on your card."}]'::jsonb where module_number = 2 and myths_json = '[]'::jsonb;
update public.modules set myths_json = '[{"myth":"Strong passwords need to be complicated gibberish.","fact":"Length matters most. A passphrase of four or more random, unrelated words is strong and easier to remember, and a password manager can handle the rest."},{"myth":"Changing my password every month is best.","fact":"Current NIST guidance (SP 800-63B) recommends long, unique passwords that you change when there''s evidence of compromise, rather than forced periodic changes that lead to weak patterns."},{"myth":"MFA by text message is useless.","fact":"SMS is the weakest MFA option because of SIM swaps and phishing, but it is still much better than a password alone. Upgrade to an authenticator app or passkey when you can."}]'::jsonb where module_number = 3 and myths_json = '[]'::jsonb;
update public.modules set myths_json = '[{"myth":"Macs and iPhones can''t get malware.","fact":"They have strong built-in protections, but malware, phishing, and malicious profiles exist for every platform. Updates and caution still matter."},{"myth":"Antivirus means I''m fully protected.","fact":"Antivirus is one layer. It doesn''t stop you from typing your password into a phishing site or sharing an OTP with a scammer."},{"myth":"Updates only add features, so I can put them off.","fact":"Many updates fix security holes that attackers already know about. Delaying them leaves a known, published weakness open on your device."}]'::jsonb where module_number = 4 and myths_json = '[]'::jsonb;
update public.modules set myths_json = '[{"myth":"The padlock means the website is safe.","fact":"HTTPS means the connection is encrypted and the site controls that domain. Scammers can get certificates for their own look-alike domains, so always check the domain itself."},{"myth":"A VPN makes me completely anonymous.","fact":"A VPN hides your traffic from the local network and your ISP and changes your visible IP address, but the VPN provider can see your connection metadata, and logins, cookies, and fingerprinting can still identify you."},{"myth":"Public Wi-Fi with a password is private.","fact":"Everyone who knows the café''s password is on the same network, and anyone can set up a look-alike hotspot. Prefer mobile data for sensitive tasks and confirm the network name with staff."}]'::jsonb where module_number = 5 and myths_json = '[]'::jsonb;
update public.modules set myths_json = '[{"myth":"Incognito mode makes me anonymous.","fact":"Private browsing only stops your browser from saving history and cookies after you close the window. Websites, your ISP, and school or work networks can still see your activity."},{"myth":"If I delete a post, it''s gone.","fact":"Screenshots, reposts, archives, and backups can keep copies after you delete the original."},{"myth":"A private account keeps everything private.","fact":"Your profile photo, name, and bio are often still public, and any follower can screenshot or share your posts. Only post what you would be comfortable seeing in public."}]'::jsonb where module_number = 6 and myths_json = '[]'::jsonb;
update public.modules set myths_json = '[{"myth":"Good OpSec means being suspicious of everything.","fact":"Good OpSec is proportional. A threat model helps you spend effort on the risks that are likely and harmful, instead of worrying about everything equally."},{"myth":"Encryption alone keeps my communications secret.","fact":"Encryption protects content, but metadata (who, when, where, how often) can still reveal a lot, and an unlocked or infected phone exposes the messages themselves."},{"myth":"One very secure email account for everything is safest.","fact":"Putting everything in one place means one breach exposes everything. Compartmentalize: separate addresses for banking, shopping, and social media limit the damage."}]'::jsonb where module_number = 7 and myths_json = '[]'::jsonb;
update public.modules set myths_json = '[{"myth":"If I''d been hacked, I would know.","fact":"Many compromises are silent. Attackers often read email, set forwarding rules, or wait. Check login alerts, active sessions, and mail rules regularly."},{"myth":"Paying a ransom guarantees I get my files back.","fact":"Paying offers no guarantee of a working key, can mark you as a target for repeat attacks, and funds criminals. Tested offline backups are the real protection."},{"myth":"Cloud sync is the same as a backup.","fact":"Sync copies deletions and encrypted files to every device too. A real backup keeps older versions or offline copies that ransomware and mistakes can''t reach."}]'::jsonb where module_number = 8 and myths_json = '[]'::jsonb;

-- Module 1
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'What is OpSec?', 'Operational Security (OpSec) is the habit of looking at your own life the way an attacker would, so you can spot which small pieces of information or behavior could be used against you, and then protect them.

The term grew out of military practice, where planners realized that enemies often learned more from ordinary, unclassified details than from secret documents. The same idea applies to everyone today. Your passwords, your home address, your daily routine, the name of your gym, and even a photo of your boarding pass are all pieces of information someone could misuse.

OpSec is not about being secretive or paranoid. It is about being deliberate. You decide what matters, who could benefit from it, and what you are willing to do to keep it safe.', 'Most people are not hacked by genius-level attacks. They are harmed because ordinary details were easy to find and easy to combine: a birthday on social media, a reused password, a pet''s name that doubles as a security answer, or a work badge visible in the background of a video call.

Attackers rarely need one dramatic secret. They collect many small facts, each harmless on its own, and assemble them into a believable picture. Once they have that picture, they can impersonate you, guess your passwords, or write a message that you are much more likely to trust.

OpSec helps you decide what is worth protecting before something goes wrong, instead of reacting afterward. It also gives you a calm, repeatable way to think about new apps, new accounts, and new situations, so you do not have to rely on fear or luck.', 'OpSec is a way of thinking, not a product. It works by asking a few simple questions over and over:

- What do I have that someone might want (money, accounts, identity, location, reputation)?
- Who might want it, and how could they get it?
- Which of my habits make that easier?
- What is the simplest change that makes it harder?

Technical tools (password managers, encryption, updates) are part of the answer, but so are physical habits (locking your screen), human behavior (not oversharing), and situational awareness (noticing who is looking over your shoulder). A good OpSec mindset treats each of these as one layer. No single layer is perfect, but together they make attacks far more expensive and less likely to succeed.

The questions also work in reverse. If you notice that something you share would be useful to a stranger, you have found a place to act.', 'Ana posts a photo celebrating her new job. The photo shows her company ID badge, her face, and the office lobby. A scammer now knows her full name, employer, and what the badge looks like. A week later, a coworker receives an email "from Ana" asking for an urgent gift-card purchase for a client.

Nothing was hacked. The attacker simply collected information Ana shared without thinking about who else could see it. The badge made the impersonation more convincing, because the scammer could reference the real lobby and the real company name.

If Ana had used OpSec thinking before posting, she could have cropped the badge out of the photo, checked her privacy settings, and told her coworkers in advance that real requests for gift cards would never come by email.', '- Before you share something, ask: "Who else can see this, and what could they do with it?"
- Treat small details (badges, tickets, addresses, routines, school or workplace logos) as pieces of a larger puzzle.
- Check what is visible in the background of photos and video calls before you post or join.
- Start with the basics covered in this course: strong unique passwords, multi-factor authentication, updates, and healthy skepticism.
- Agree with family and coworkers on a simple rule for money requests, such as "always confirm by phone."
- Remember the motto: you do not need to know everything, only what to protect, what can go wrong, and how to reduce the risk.', '[{"question":"Which statement best describes OpSec?","options":["A type of antivirus software","A way of thinking about what to protect and how it could be exposed","A government-only security clearance","A method for hacking into accounts"],"answer":1,"explanation":"OpSec is a mindset and process for identifying and protecting critical information. Tools help, but OpSec itself is not a product."},{"question":"Which of these is an example of an OpSec mistake?","options":["Using a password manager","Locking your phone with a PIN","Posting a photo that clearly shows your work ID badge","Installing system updates"],"answer":2,"explanation":"A visible ID badge reveals your name, employer, and badge design, which can be used for impersonation or social engineering."},{"question":"OpSec covers which areas?","options":["Only computers and networks","Only physical locks and doors","Technical, physical, behavioral, and informational habits","Only what you post on social media"],"answer":2,"explanation":"OpSec includes technical security, physical security, human behavior, information handling, and situational awareness."}]'),
  (2, 'Why OpSec Matters', 'This lesson explains why ordinary people, not just companies or governments, are targets, and why small precautions have a large effect.

Many people assume that cybercrime is aimed at large organizations with valuable data. In reality, a large share of attacks are low-effort and opportunistic. Criminals send huge volumes of messages and run automated checks, then focus their time on the accounts that respond. Being an ordinary person is not a shield; it can even be an advantage for an attacker, because ordinary people often have weaker protections.

The practical result is simple: if you have an account, a phone, or money that can be reached, you are part of the target pool.', 'Criminals often work at scale. They send millions of phishing messages, test leaked passwords against many websites automatically, and buy and sell personal data. You do not have to be famous or rich to be a target; you just have to be reachable.

The consequences are real: drained bank or e-wallet accounts, stolen social media accounts used to scam your friends, identity theft, harassment, or loss of irreplaceable photos and files. Some harms are emotional as well as financial. Victims often feel embarrassed, which can delay reporting and make recovery harder.

The good news is that attackers are looking for the easiest target. Small, consistent habits move you out of that group, and that effect is much larger than most people expect.', 'Most attacks against individuals follow the path of least resistance. Attackers look for:

- Reused passwords that already appeared in a data breach
- Accounts without multi-factor authentication
- People who can be rushed or frightened into acting quickly
- Devices that are missing security updates
- Personal details that are public and can answer security questions

Because attackers go for easy targets, each basic protection you add pushes you out of the "easy" group. You do not have to be perfectly secure, just harder to exploit than the average target.

This is why the most effective steps are often the most boring ones: unique passwords, MFA on email, prompt updates, and a habit of pausing before acting on urgent messages. These steps defeat the automated, high-volume attacks that make up much of the threat.', 'Marco reused the same password for an old online forum and his email. The forum suffered a data breach, and the leaked email-and-password list was shared online. An automated tool tried that combination on popular email services and got in.

From his email, the attacker reset his passwords for social media and an online shopping account. Marco was never personally "chosen"; his reused password made him an easy match.

If Marco had used a unique password for email and turned on MFA, the leaked forum password would have been useless against his inbox. The attacker would have moved on to someone else within minutes.', '- Use a unique password for every important account (a password manager makes this practical).
- Turn on multi-factor authentication for email, banking, and social media first.
- Install updates on your phone and computer promptly.
- Slow down when a message pushes urgency or fear.
- Check whether your email address has appeared in a known breach, and change any password that did.
- Back up the files you could not bear to lose.', '[{"question":"Why are ordinary people targeted by cybercriminals?","options":["Only because they are famous","Because many attacks are automated and aimed at anyone who is reachable","They are not; only companies are targeted","Because ordinary people always have weak computers"],"answer":1,"explanation":"Many attacks run at scale (mass phishing, automated password testing), so anyone with an account can be hit."},{"question":"Marco''s email was taken over mainly because:","options":["His email provider was hacked directly","He reused a password that leaked in a different site''s breach","He used a long passphrase","He had multi-factor authentication enabled"],"answer":1,"explanation":"Reused passwords leaked from one site can be tried on others. This is called credential stuffing."},{"question":"What does \"pushing yourself out of the easy group\" mean?","options":["Becoming impossible to hack","Adding basic protections so automated or low-effort attacks fail against you","Deleting all your online accounts","Hiring a security company"],"answer":1,"explanation":"No one is perfectly secure, but basic protections stop the most common, low-effort attacks."},{"question":"Which account should you usually secure first?","options":["An old game account","Your primary email account","A newsletter subscription","A weather app"],"answer":1,"explanation":"Your email is often used to reset every other password, so whoever controls it can take over many other accounts."}]'),
  (3, 'The Five Steps of OpSec', 'The classic OpSec process has five steps: (1) identify critical information, (2) analyze threats, (3) analyze vulnerabilities, (4) assess risk, and (5) apply countermeasures. It is a repeatable checklist for deciding what to protect and how.

The steps are meant to be walked through in order, but they also loop. A countermeasure you apply can reveal new information or new weaknesses, and that sends you back to step one. Think of the five steps as a cycle rather than a one-time project.', 'Without a process, security turns into random worrying or buying tools you do not need. The five steps help you focus effort where it matters most and give you a way to re-check your situation when your life changes (a new job, a move, a new device).

The process also protects you from two common traps. The first is protecting everything equally, which uses up time and money on low-value items. The second is protecting only the things you can easily imagine being attacked, which leaves hidden weaknesses unaddressed.', '- Step 1 — Identify critical information: What would hurt if it leaked or was lost? Examples: email login, bank details, home address, ID documents, private photos.
- Step 2 — Analyze threats: Who might want it? Scammers, identity thieves, a stalker, a nosy acquaintance, automated bots.
- Step 3 — Analyze vulnerabilities: How could they get it? Reused passwords, public social media posts, an unlocked phone, no backups.
- Step 4 — Assess risk: For each threat and vulnerability, how likely is it and how bad would it be? Focus on the combinations that are both likely and harmful.
- Step 5 — Apply countermeasures: Choose practical fixes, such as MFA, privacy settings, a screen lock, or backups, then revisit the steps periodically.

A useful habit is to write each step down in a few lines. The written version is easier to revisit, and it helps you notice when a plan no longer matches your life.', 'Lea is starting an online business and runs the five steps:

- Critical information: her business email, payment account, and customer list.
- Threats: phishing scammers and people trying to take over her business page.
- Vulnerabilities: she uses SMS codes only, and her personal phone number is public on the page.
- Risk: account takeover is likely and would stop her sales.
- Countermeasures: she switches to an authenticator app, uses a separate business contact number, and enables login alerts.

After a few months, Lea hires a part-time assistant. She returns to step one, realizes the assistant needs access to some accounts but not the payment account, and sets up separate logins. The cycle caught a new risk before it became a problem.', '- Write down your top five pieces of critical information today.
- For each, list one realistic threat and one weakness.
- Fix the highest-risk item first; do not try to fix everything at once.
- Repeat the process when something big changes in your life, such as a new job, a move, a new device, or a new family member who uses your accounts.', '[{"question":"What is the first step of the OpSec process?","options":["Apply countermeasures","Assess risk","Identify critical information","Buy security software"],"answer":2,"explanation":"You cannot protect something until you know what it is, so the process starts with identifying critical information."},{"question":"\"My social media is public and shows my school and hometown\" describes a:","options":["Threat","Vulnerability","Countermeasure","Critical asset"],"answer":1,"explanation":"A vulnerability is a weakness that a threat could exploit. Public personal details are a weakness."},{"question":"In risk assessment, which items should you usually fix first?","options":["Ones that are unlikely and low impact","Ones that are both likely and harmful","Whichever is easiest to talk about","Only the newest threats in the news"],"answer":1,"explanation":"Risk combines likelihood and impact. Prioritize what is both likely to happen and damaging if it does."},{"question":"Why should you repeat the five steps over time?","options":["Because the law requires it every month","Because your life, devices, and threats change","Because the steps change every year","You never need to repeat them"],"answer":1,"explanation":"New jobs, devices, relationships, and threats change what you need to protect and how."}]'),
  (4, 'Threats, Vulnerabilities, and Risks', 'These three words are often mixed up:

- A threat is someone or something that could cause harm (a scammer, malware, a thief, a flood).
- A vulnerability is a weakness that the threat could use (a reused password, an unlocked door, an outdated app).
- Risk is the chance that a threat will exploit a vulnerability, combined with how bad the result would be.

A useful way to remember the difference: threats are the "who or what," vulnerabilities are the "how," and risk is the "how likely and how bad."', 'Knowing the difference keeps you from wasting effort. You usually cannot remove threats (scammers will always exist), but you can almost always reduce vulnerabilities, and that lowers your risk.

People often worry about threats in the news, such as a famous new malware strain, while leaving their own vulnerabilities untouched. Shifting your attention to the weakness you control is one of the most productive security habits you can build.', 'A simple way to think about it: Risk ≈ Likelihood × Impact.

Example: a thief (threat) could steal your phone. If your phone has no screen lock (vulnerability), the impact is high because they can open your banking and email apps. Adding a strong PIN and remote-wipe does not stop thieves from existing, but it greatly reduces the impact, and therefore the risk.

You can respond to a risk in four ways: reduce it (add protections), avoid it (stop the risky activity), transfer it (for example, insurance or a bank''s fraud protection), or accept it (if it is unlikely and minor). Most good decisions combine more than one response. For example, you might reduce the risk of car theft with a lock, transfer part of it with insurance, and accept the rest.', 'Jo connects to free airport Wi-Fi to check email. The threat is someone on the same network trying to intercept traffic or running a fake hotspot. The vulnerability would be logging into a site that is not using HTTPS, or entering a password on a fake captive-portal page.

Because Jo''s email uses HTTPS and MFA, and Jo checks the network name with airport staff, the likelihood and impact are both low, so the risk is acceptable. Jo would still avoid entering a password on any unusual sign-in page, and would switch to mobile data for banking.

This example shows that the same threat can produce very different risk depending on the vulnerabilities present.', '- When you worry about a threat, ask: "Which of my weaknesses would it need?" Then fix that weakness.
- Use the four responses (reduce, avoid, transfer, accept) consciously, and note which one you chose.
- Focus on vulnerabilities you control: passwords, updates, settings, and habits.
- Re-check your list when you change devices, apps, or networks.', '[{"question":"A phishing scammer is an example of a:","options":["Threat","Vulnerability","Risk","Countermeasure"],"answer":0,"explanation":"A threat is an actor or event that could cause harm."},{"question":"An app that has not been updated in two years is an example of a:","options":["Threat","Vulnerability","Risk transfer","Asset"],"answer":1,"explanation":"Outdated software may contain known, unpatched flaws, which makes it a vulnerability."},{"question":"Which formula best summarizes risk?","options":["Risk = Threat + Password","Risk ≈ Likelihood × Impact","Risk = Number of devices","Risk = Cost of antivirus"],"answer":1,"explanation":"Risk considers both how likely something is and how damaging it would be."},{"question":"Buying travel insurance for a laptop is an example of which risk response?","options":["Avoid","Accept","Transfer","Ignore"],"answer":2,"explanation":"Insurance transfers some of the financial impact to someone else."}]'),
  (5, 'Understanding Your Digital Footprint', 'Your digital footprint is the trail of information about you that exists online. It has two parts:

- Active footprint: things you share on purpose (posts, photos, comments, profiles).
- Passive footprint: things collected about you, often without you noticing (location history, cookies, app data, data broker profiles, other people tagging you).

Most people focus only on the active part. The passive footprint is often larger, and it is harder to see because you did not write it yourself.', 'Pieces of your footprint can be combined to answer security questions, guess passwords, find where you live or work, impersonate you, or build a convincing scam aimed at you or your family. Once something is public, copies may exist that you can no longer delete.

Your footprint also includes what other people share about you. A friend''s group photo, a tagged comment, or a family member''s post can reveal details you never published yourself. Managing your footprint therefore means managing your own posts and your influence over what others post.', 'Information spreads and gets combined:

- Search engines index public profiles and posts.
- Screenshots and reposts can outlive deleted content.
- Data brokers and "people search" sites compile records from many sources in some countries.
- Photos can contain metadata such as the time and, sometimes, GPS location.
- Friends and family can reveal things about you (tags, comments, group photos).
- Apps may collect location, contacts, and usage data in the background.

The key idea is aggregation. Each fact on its own may seem trivial, but collected together they form a profile that is far more revealing than any single item.', 'Searching for "Rina Santos" plus her city brings up her public social media profile, a running-club results page showing her usual race times, and a tagged photo outside her apartment building. Together, these reveal where she lives and when she is usually out jogging.

No single item seemed risky, but the combination exposes her routine. A stranger could now predict when her home is empty, recognize her in person, or use her interests to write a convincing message. Rina could reduce this by hiding the old tagged photo, making her race results visible only to her club, and avoiding real-time posts from her regular route.', '- Search your own name (and usernames, email, and phone number) to see what is public.
- Review privacy settings on each social account; limit old posts to friends.
- Remove or untag photos that reveal your home, school, or routine.
- Use different usernames for unrelated sites if you do not want them linked.
- Think before posting in real time; post travel photos after you return.
- Review app location permissions and delete accounts you no longer use.', '[{"question":"Which is part of your passive digital footprint?","options":["A selfie you posted","A comment you wrote","Location history collected by an app","Your public bio"],"answer":2,"explanation":"Passive footprint data is collected about you, often in the background, rather than shared on purpose."},{"question":"Why can harmless-seeming posts become risky?","options":["They use too much storage","They can be combined to reveal routines, locations, or security answers","Social networks sell them as photos","They slow down your phone"],"answer":1,"explanation":"Attackers combine small details to build a fuller picture of you."},{"question":"A safer way to share vacation photos is to:","options":["Post them live with location tags","Post them after you return home","Post your flight details","Make your account fully public"],"answer":1,"explanation":"Posting after the trip avoids advertising that your home is empty and where you are right now."},{"question":"A good first step to understand your footprint is to:","options":["Search your own name and usernames","Buy a VPN","Change your phone","Delete your email account"],"answer":0,"explanation":"Searching yourself shows what strangers can easily find."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 1
on conflict (module_id, lesson_order) do nothing;

-- Module 2
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'What is Social Engineering?', 'Social engineering is manipulating people, rather than computers, into giving up information, money, or access. Instead of breaking a password, the attacker convinces you to hand it over.

It works because most of security depends on human judgment. A lock can be perfect and still be opened by someone who persuades the person holding the key. Social engineering is as old as fraud itself; digital tools have simply made it faster, cheaper, and easier to scale.', 'People are often the easiest way in. Strong passwords and encryption do not help if you read a one-time code to a caller who claims to be from your bank. Many major incidents have started with a convincing message or phone call.

Social engineering also targets people who feel confident about their own security. Smart, careful people are still vulnerable when they are busy, distracted, or trying to be helpful. Understanding the pattern helps you recognize the moment when your judgment is being steered.', 'Social engineers typically:

- Research the target (social media, company websites, leaked data).
- Build a believable story (a pretext): delivery company, bank fraud team, IT support, a relative in trouble.
- Create pressure: urgency, fear, authority, or a reward.
- Ask for a specific action: click a link, share a code, send money, install an app, or open a door.

The channel can be email, text message, phone call, chat apps, social media, or in person. Many attacks combine channels. A fake email might be followed by a phone call to "confirm" the request, which makes the story feel more real.

Notice that the attacker needs you to act before you verify. Slowing down is often enough to break the attack.', 'A caller says, "This is your bank''s fraud department. We detected a suspicious transfer. To block it, I''ll send a code to your phone; please read it back to verify your identity."

The "code" is actually a one-time password the scammer triggered by logging into the victim''s account. Reading it out gives the scammer access. The caller sounds calm and professional, and the request is framed as protecting the victim, which is what makes it effective.

A careful response is simple: end the call, find the bank''s number on the back of your card or on its official website, and call that number. Legitimate staff will understand, and they will never need you to read back a code.', '- Never share one-time codes, PINs, or passwords with anyone who contacts you. Legitimate banks and services do not ask for them.
- Hang up and call back using the number on your card or the official website.
- Treat urgency as a warning sign, not a reason to hurry.
- Verify unusual requests from friends or coworkers through a second channel, such as a call to a number you already know.
- Tell family members about the pattern so they can recognize it too.', '[{"question":"Social engineering mainly targets:","options":["Computer hardware","Human trust and behavior","Wi-Fi routers only","Encryption algorithms"],"answer":1,"explanation":"Social engineering manipulates people into taking actions that help the attacker."},{"question":"A caller from \"your bank\" asks you to read back a code just sent to your phone. What should you do?","options":["Read it quickly to stop the fraud","Hang up and call the bank using the number on your card","Send it by text message instead","Ask them to email it to you"],"answer":1,"explanation":"One-time codes should never be shared. Contact the bank yourself through a trusted number."},{"question":"Which is a common social engineering pressure tactic?","options":["Giving you plenty of time","Urgency or fear","Encouraging you to verify","Using an official helpline you looked up"],"answer":1,"explanation":"Urgency and fear make people skip careful thinking."}]'),
  (2, 'Phishing, Spear Phishing, and Smishing', '- Phishing: fraudulent messages, usually email, sent to many people to steal credentials, money, or install malware.
- Spear phishing: a targeted phishing message tailored to a specific person or group, using details about them.
- Smishing: phishing by SMS or text/chat message.
- Vishing: phishing by voice call.

The names describe the channel or the level of targeting. The underlying goal is the same: make you act on a false message.', 'Phishing remains one of the most common ways accounts are compromised and malware is delivered. Text-message scams about deliveries, prizes, bank holds, or e-wallet problems are widespread because people tap links on phones quickly.

Spear phishing is especially dangerous in workplaces, because a message that appears to come from a manager or a trusted supplier can bypass the caution people normally apply to strangers.', 'A phishing message usually links to a fake login page that looks like a real service, or carries an attachment that installs malware. Spear phishing adds personal details (your name, your boss''s name, a real project) to make it believable.

On phones, it is harder to see the real link address, and sender names can be spoofed, so smishing is especially effective. A fake page often copies logos and layouts exactly, and it may ask for your password, one-time code, or card number in a way that looks routine.

Attackers also use "sense of urgency" and "sense of routine" together. A message that looks like an ordinary notification, arriving at a time when you expect one, is harder to question.', 'A text arrives: "Your parcel is on hold due to an unpaid fee of 35.00. Pay within 24 hours: parcel-redelivery-help.example." The page asks for card details and then a one-time code "to confirm."

In a spear-phishing version, an email to an accounts clerk appears to come from her manager, mentions a real supplier, and asks her to update the supplier''s bank details before Friday''s payment run. The clerk recognizes the project name and the manager''s writing style, which makes the request feel safe. The only problem is that the bank details lead to the attacker.

In both cases, the safe move is the same: stop, check through a separate channel, and report the message.', '- Do not tap links in unexpected messages; open the official app or type the website address yourself.
- Check the real domain carefully (look-alike spellings and extra words are common).
- Be suspicious of small "fees," prizes, or account holds that require immediate action.
- Verify payment-detail changes by phone using a number you already have.
- Use a password manager: it will not auto-fill on a fake domain, which is a useful warning.
- Report phishing to your provider and delete it.', '[{"question":"Smishing is phishing delivered by:","options":["Email","Text or chat message","Postal mail","USB drive"],"answer":1,"explanation":"Smishing combines SMS and phishing."},{"question":"What makes spear phishing different from regular phishing?","options":["It is always sent by phone","It is tailored to a specific person or group using personal details","It never contains links","It is legal"],"answer":1,"explanation":"Spear phishing is targeted and uses research to seem believable."},{"question":"Why can a password manager help detect phishing?","options":["It blocks all emails","It will not auto-fill credentials on a domain that does not match the saved one","It deletes suspicious texts","It calls the bank for you"],"answer":1,"explanation":"Auto-fill is tied to the exact website. If it does not fill, double-check the address."},{"question":"A supplier emails asking to change their bank account for the next payment. Best response?","options":["Update it immediately","Reply to the email to confirm","Call the supplier using a phone number you already had on file","Forward it to a friend"],"answer":2,"explanation":"Replying may reach the attacker. Verify through an independent, known channel."}]'),
  (3, 'Pretexting and Impersonation', 'Pretexting is creating a made-up scenario (a pretext) to get someone to share information or grant access. Impersonation is pretending to be a trusted person or organization, such as IT support, a delivery driver, a government agency, or a family member.

The two often appear together. The impersonation provides the identity, and the pretext provides the reason the request makes sense.', 'People are naturally helpful and respect authority. A believable role can get an attacker past security that would stop a direct request. Impersonation also happens online through fake social media profiles and cloned accounts that message your friends.

Because the story is built around your good intentions, victims often feel they were simply being kind. That is why it is important to focus on the request itself, not on how polite or official the person sounds.', 'The attacker gathers enough details to sound legitimate, then plays a role:

- "IT helpdesk" asking you to install remote-access software.
- A "new employee" who forgot their badge and asks you to hold the door.
- A cloned profile of a friend asking to borrow money or for a code "sent to your number by mistake."
- A "government official" threatening fines or arrest unless you pay now.

A key warning sign is a mismatch between the role and the request. Real IT staff rarely need you to install unfamiliar software, and real government agencies rarely demand immediate payment by unusual methods.', 'Someone creates a new account using your cousin''s name and profile photo, then messages relatives: "New account, lost my old phone. Can you send me the 6-digit code you''ll receive? It''s for my account recovery."

The code is actually for taking over the relative''s own messaging account. The fake profile looked familiar, the story was plausible, and the request seemed like a simple favor. Relatives who paused and called the cousin on a known number would have discovered the impersonation immediately.', '- Verify identity through a channel you already trust (call the person, ask a question only they would know).
- Do not install remote-access apps because someone called or messaged you.
- Politely refuse to let unknown people follow you through secure doors; direct them to reception.
- Government agencies and banks generally do not demand immediate payment by gift cards, crypto, or e-wallet transfers.
- Never share a verification code, no matter who asks for it.
- Report cloned profiles to the platform and warn your contacts.', '[{"question":"A \"pretext\" in social engineering is:","options":["A type of malware","A made-up story used to justify a request","An encrypted message","A backup file"],"answer":1,"explanation":"The pretext is the believable scenario the attacker uses."},{"question":"A friend''s \"new account\" asks you for a verification code you just received. This is most likely:","options":["A normal request","An account takeover attempt","A software update","A delivery notice"],"answer":1,"explanation":"Codes sent to your number are for your account. Sharing them can let someone take it over."},{"question":"Someone without a badge asks you to hold the office door. The best response is to:","options":["Let them in to be polite","Direct them to reception or security","Give them your badge","Ignore company policy"],"answer":1,"explanation":"Following someone through a secure door is called tailgating. Reception can verify them."}]'),
  (4, 'Recognizing Suspicious Links and Emails', 'This lesson teaches the practical checks you can do on any message before you trust it: who really sent it, where links really go, and whether the request makes sense.

No single check is decisive. The goal is to combine several small checks so that a fake message is caught by at least one of them.', 'Display names, logos, and formatting are easy to fake. The details that are harder to fake, like the actual domain, are what reveal most phishing.

Once you know what to look for, these checks take only a few seconds. They can prevent losses that would take months to recover from.', 'Key checks:

- Sender address: the display name can say anything; look at the actual address after the @. "NorthBank Security <alerts@northbank-verify.example>" is not northbank.example.
- Reply-To: a mismatch between From and Reply-To can be a warning sign.
- Link destination: on a computer, hover over the link to preview the real address. On a phone, long-press to preview. The real domain is the registered name just before the first single slash that follows the address. Everything to the left of it is a subdomain you can freely invent. In "northbank.example.login-secure.example/account", the real domain is "login-secure.example", because that is the name the owner registered.
- Look-alike characters: "rn" can look like "m", and "0" like "o".
- Attachments: be wary of unexpected files, especially archives, macro-enabled documents, or files that ask you to "enable content."
- Context: Were you expecting this? Does the request match how this organization normally contacts you?

When several checks disagree, treat the message as suspicious until verified.', 'An email says: "Your CloudDrive storage is full. Click to keep your files." The sender shows "CloudDrive Support," but the address is support@clouddrive-storage-alert.example, and hovering over the button reveals http://clouddrive.example.account-verify.example/login.

The real domain is account-verify.example, not clouddrive.example. It is phishing. The attacker used the familiar word "clouddrive" as a subdomain to make the link look legitimate at a glance, which is why reading the full address matters.', '- Hover or long-press before clicking.
- Find the real domain (the registered name just before the first single "/").
- Do not trust a padlock alone; phishing sites can use HTTPS too.
- When unsure, go to the service directly through a bookmark or the official app.
- Report suspicious messages using your email provider''s "Report phishing" option.', '[{"question":"In the link \"https://northbank.example.secure-login.example/verify\", what is the real domain?","options":["northbank.example","secure-login.example","verify","https"],"answer":1,"explanation":"The registered domain is the last part before the first single slash: secure-login.example. \"northbank.example\" is just a subdomain label."},{"question":"The padlock icon (HTTPS) in a browser means:","options":["The website is definitely legitimate","The connection is encrypted, but the site could still be fake","The site has been approved by your bank","The site has no malware"],"answer":1,"explanation":"HTTPS encrypts the connection. Anyone, including scammers, can get a certificate for their own domain."},{"question":"How can you preview a link on a phone?","options":["Tap it quickly","Long-press it","Shake the phone","Forward it to yourself"],"answer":1,"explanation":"Long-pressing usually shows the destination without opening it."},{"question":"Which attachment request is a strong warning sign?","options":["A PDF receipt you expected","A document that asks you to \"enable content\" or macros","A photo from a family member you were waiting for","A calendar invite from your known coworker"],"answer":1,"explanation":"Macros can run code. Unexpected requests to enable them are a common malware delivery method."},{"question":"An email shows the display name \"IT Support\" but the address is from an unknown domain. You should:","options":["Trust the display name","Treat it as suspicious and verify through your real IT department","Reply with your password","Click the link to check"],"answer":1,"explanation":"Display names are trivial to fake. The actual address and an independent check matter."}]'),
  (5, 'Psychological Manipulation Tactics', 'Attackers rely on well-known principles of persuasion and emotion. Recognizing these levers helps you notice manipulation while it is happening.

These principles are not inherently bad. Urgency, authority, and reciprocity are used in legitimate marketing and everyday life. Manipulation happens when they are used to override your judgment rather than inform it.', 'Smart, careful people still fall for scams when they are rushed, scared, excited, or tired. Knowing the tactics lets you pause at the right moment.

The most useful skill is not memorizing a list of tricks. It is noticing the feeling that someone is pushing you to act now, and treating that feeling as information.', 'Common levers:

- Urgency: "Act within 1 hour or your account will be closed."
- Fear: threats of arrest, fines, or losing money.
- Authority: pretending to be a boss, police, bank, or government.
- Scarcity / reward: "Only 3 slots left," "You have won a prize."
- Social proof: "Everyone in your team has already done this."
- Liking and familiarity: friendly chat, shared interests, flattery, or romance built over weeks.
- Reciprocity: doing you a small favor first so you feel you owe them.
- Commitment: getting a small "yes" first, then escalating the request.

Most scams combine several of these. A friendly start builds liking, a small early win builds commitment, and a deadline creates urgency.', 'An online "investment mentor" is friendly for weeks, shares screenshots of profits, and helps with a small first investment that appears to grow. Then the mentor urges a much larger deposit "before the window closes." When the victim tries to withdraw, they are told to pay "taxes" or "fees" first.

This uses liking, social proof, commitment, and urgency together. Each step felt reasonable on its own, which is why the pattern is hard to see from the inside. A friend asking "what is this really for?" at the start would have been a useful check.', '- Name the emotion: "I feel rushed / scared / excited. Why?"
- Introduce a pause: legitimate requests can wait while you verify.
- Talk it through with someone you trust before sending money.
- Be very cautious of investment or romance contacts who only exist online and steer you to transfers or crypto.
- If you must pay a fee to receive a prize or withdraw money, it is a scam warning sign.', '[{"question":"\"Your account will be suspended in 30 minutes\" mainly uses:","options":["Reciprocity","Urgency","Liking","Scarcity of products"],"answer":1,"explanation":"A tight deadline is designed to make you act before thinking."},{"question":"Being asked to pay a fee to withdraw your own investment \"profits\" is a sign of:","options":["A normal bank process","A likely scam","High interest rates","Tax law"],"answer":1,"explanation":"Demanding new payments before releasing funds is a common scam pattern."},{"question":"Which is the most effective general defense against manipulation?","options":["Responding as fast as possible","Pausing and verifying through an independent channel","Trusting anyone who sounds official","Keeping it secret from family"],"answer":1,"explanation":"Manipulation depends on rushing you. Pausing and verifying breaks the pattern."}]'),
  (6, 'Avoiding Online Scams', 'Online scams are schemes that trick you into sending money, goods, or personal data. Common types include fake online shops, marketplace scams, job and task scams, romance scams, investment scams, prize scams, and tech-support scams.

Most scams share a basic shape: the victim is offered something good, asked to pay or share something first, and then faces new demands before receiving anything. Recognizing that shape is more useful than memorizing every variation.', 'Scams cause large financial losses and are often hard to reverse, especially when payment is made by bank transfer, e-wallet, gift cards, or cryptocurrency. Victims also lose personal data that can be reused in later scams.

Scam victims are sometimes targeted again. Fake recovery services and "asset recovery" offers often contact people who have already been defrauded, which adds insult to injury.', 'Typical patterns:

- Fake shops: prices far below normal, new websites, pressure to pay by direct transfer.
- Marketplace scams: "buyers" who overpay and ask for a refund, or "sellers" who want payment outside the platform.
- Task/job scams: easy pay for liking videos or rating products, then a demand to "top up" to unlock earnings.
- Tech-support scams: pop-ups or calls claiming your computer is infected, asking you to call a number or install remote-access software.
- Recovery scams: people offering to recover money you lost to an earlier scam, for a fee.

A common thread is payment. Scammers prefer methods that are fast and hard to reverse, so an unusual payment request is often the clearest warning sign.', 'Ben applies for an online "part-time job" that pays for completing simple tasks. After a few small payouts, he is told he must deposit money to unlock a higher-paying "premium task." The balance shown on the site grows, but withdrawals are always blocked until he pays more.

The early payouts were bait to build trust. The growing balance was a number on a screen, not money in his account. Ben could have protected himself by asking whether the job was listed by a company he could verify, and by noticing that any job requiring a deposit is a warning sign.', '- If an offer is far better than normal, research it before paying.
- Keep transactions inside the marketplace''s official payment system.
- Prefer payment methods with buyer protection.
- Never pay to get a job, a prize, or your own money back.
- Close scary pop-ups; real security warnings do not ask you to call a phone number.
- If you were scammed, contact your bank or e-wallet provider immediately and report it to the authorities (covered in Module 8).', '[{"question":"A \"job\" requires you to deposit money to unlock your earnings. This is:","options":["Normal onboarding","A task/job scam warning sign","A tax requirement","A bonus program"],"answer":1,"explanation":"Legitimate employers do not require you to pay to receive your wages."},{"question":"A pop-up says your computer is infected and to call a support number. You should:","options":["Call immediately","Close the browser tab or window and run your normal security software","Install the software they suggest","Pay for the repair"],"answer":1,"explanation":"Tech-support scam pop-ups are fake. Close them; do not call or install anything."},{"question":"Why should you keep marketplace payments inside the platform?","options":["It is always cheaper","You may lose buyer protection and dispute options when you pay outside it","It is required by law everywhere","Outside payments are faster"],"answer":1,"explanation":"Platforms can usually only help with transactions they processed."},{"question":"Someone offers to recover money you lost to a scam, for an upfront fee. This is most likely:","options":["A legitimate law firm","A recovery scam","Your bank","Insurance"],"answer":1,"explanation":"Scam victims are often targeted again by fake recovery services."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 2
on conflict (module_id, lesson_order) do nothing;

-- Module 3
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Strong Passwords', 'A strong password is long, unique to one account, and hard to guess, even for a computer trying billions of guesses.

Strength is a property of how a password was made, not how complicated it looks. A random string of four unrelated words can be far stronger than a short string full of symbols that follows a familiar pattern.', 'Weak or reused passwords are one of the most common reasons accounts get taken over. Because most people have dozens of accounts, the password habit you pick once can quietly protect or expose all of them.

Strong passwords also limit the damage from a single leak. If each account has its own password, a breach at one site cannot be used to open the others.', 'Attackers guess passwords using lists of common and leaked passwords plus predictable patterns (Name2024!, qwerty). Length adds the most strength: each extra character multiplies the number of possibilities. A passphrase of four or more random, unrelated words is both strong and memorable.

Current NIST guidance (SP 800-63B) favors length and checking against breached-password lists over forced complexity rules and routine periodic changes. Complexity rules often lead people to predictable substitutions like "P@ssw0rd," which attackers test first.

It also helps to know that offline attacks, where stolen password data is guessed on powerful hardware, are much faster than typing guesses into a login page. That is why the length and randomness of the password matter so much.', 'Kim uses "Summer2025!" everywhere. It meets most complexity rules but follows a very common pattern and appears in guessing lists, so it falls quickly in an offline attack.

Kim''s situation is common. The password looks strong to a person, but to a computer it is one of a small set of predictable patterns. Switching to a random passphrase for her email, and a manager-generated password for each other account, would make her far harder to crack.', '- Use at least 12–16 characters; longer for important accounts.
- Use a random passphrase or let a password manager generate one.
- Never reuse passwords across accounts.
- Do not include your name, birthday, pet, or favorite team.
- Change a password when there is a reason (a breach or suspicion), not on a fixed calendar.', '[{"question":"Which usually adds the most strength to a password?","options":["Adding one symbol","Making it longer","Capitalizing the first letter","Adding the current year"],"answer":1,"explanation":"Length increases the number of possible combinations the most."},{"question":"Why is \"Summer2025!\" weak?","options":["It is too long","It follows a common, predictable pattern","It has no letters","It is random"],"answer":1,"explanation":"Season + year + symbol is a pattern attackers try early."},{"question":"Reusing one strong password on many sites is:","options":["Safe if it is long","Risky, because one breach exposes every account","Recommended","Required by MFA"],"answer":1,"explanation":"Reuse lets one leak unlock many accounts."}]'),
  (2, 'Password Managers', 'A password manager is an app that generates, stores, and auto-fills unique passwords for you, protected by one strong master password (and ideally MFA).

It replaces the impossible task of memorizing many random passwords with the simpler task of remembering one good passphrase and keeping your recovery method safe.', 'It is practically impossible to remember dozens of unique strong passwords. A manager makes "unique everywhere" achievable.

Managers also add a built-in phishing check, because auto-fill is tied to the exact website where the password was saved. Many people also use a manager to store secure notes, recovery codes, and passkeys.', 'Your vault is encrypted on your device with a key derived from your master password. Reputable managers are designed so the provider cannot read your vault. Browser extensions and apps auto-fill only on the domain the password was saved for, which also helps catch phishing.

The master password is the single point you must protect. Use a long passphrase you have never used anywhere else, and keep a recovery kit or emergency access method somewhere safe offline. If you lose both the master password and recovery options, the vault may become permanently inaccessible, which is a deliberate design choice.

Password managers can also generate passwords for new accounts and warn you about reused or breached passwords.', 'After a breach at a shopping site, Paolo only has to change that one site''s password, because his manager gave every account a different one. He also noticed the manager did not offer to fill in the login on a look-alike site that had arrived in an email, which was a clue that the email was fake.', '- Choose a well-known, actively maintained password manager.
- Protect it with a long, unique master passphrase and MFA.
- Store your recovery/emergency kit somewhere safe offline.
- Move your most important accounts (email, banking) in first.
- Review the manager''s security report for reused or weak passwords every few months.', '[{"question":"What protects a password manager''s vault?","options":["Nothing","Encryption tied to your master password","Your phone number only","The website''s security"],"answer":1,"explanation":"The vault is encrypted using a key derived from your master password."},{"question":"Why can a password manager help against phishing?","options":["It blocks emails","It only auto-fills on the matching domain","It changes your IP","It scans attachments"],"answer":1,"explanation":"If auto-fill does not trigger, the site may be fake."},{"question":"The master password should be:","options":["Short and simple","Long, unique, and not used anywhere else","Your email password","Written on your monitor"],"answer":1,"explanation":"It guards everything else, so it must be strong and unique."}]'),
  (3, 'Multi-Factor Authentication (MFA)', 'MFA requires two or more kinds of proof to log in: something you know (password), something you have (phone, security key), or something you are (fingerprint, face).

The idea is that an attacker who has stolen one factor, such as a password from a leak, still cannot get in without the second factor.', 'With MFA, a stolen password alone is usually not enough to break in. For email and banking, MFA is one of the highest-value protections you can add.

MFA does not make you invulnerable, but it turns many attacks from simple into expensive, which is exactly what most attackers avoid.', 'Common methods, roughly from weaker to stronger: SMS codes, email codes, authenticator-app codes (TOTP), push approvals with number matching, and passkeys or hardware security keys (FIDO2/WebAuthn). SMS can be undermined by SIM-swap attacks. Codes and push approvals can still be phished or abused by "MFA fatigue" spam, while passkeys and security keys are designed to resist phishing because they are bound to the real website.

When a service offers several methods, choose the strongest one you can use consistently and keep at least one backup method in case you lose your phone.

Note that some MFA codes can be typed into a fake site by a victim who is tricked, so the "real site" check still matters. Passkeys and hardware keys are the most resistant because they will not respond to a look-alike domain at all.', 'An attacker with Dee''s password triggers repeated login push prompts at 2 a.m., hoping she taps "Approve" to make them stop. She denies them and changes her password. Because she had number matching turned on, she would also have seen a number on the prompt that did not match the login screen the attacker was using.', '- Turn on MFA for email, banking, e-wallets, and social media first.
- Prefer passkeys, security keys, or an authenticator app over SMS when available.
- Never approve a login prompt you did not start.
- Save backup codes somewhere safe.
- Keep your backup method current, such as a second device or a spare security key.', '[{"question":"Which is generally the most phishing-resistant MFA option?","options":["SMS code","Email code","Passkey or hardware security key","Security question"],"answer":2,"explanation":"Passkeys and FIDO2 keys are bound to the real site, so fake sites cannot use them."},{"question":"You get a login approval prompt you did not request. You should:","options":["Approve it","Deny it and change your password","Ignore it forever","Forward it"],"answer":1,"explanation":"An unexpected prompt suggests someone has your password."},{"question":"A known weakness of SMS codes is:","options":["They are too long","SIM-swap attacks can redirect them","They need internet","They cannot be typed"],"answer":1,"explanation":"Attackers can sometimes trick carriers into moving your number to their SIM."}]'),
  (4, 'Account Recovery Security', 'Account recovery is how you regain access when you forget a password or lose a device: recovery email, phone number, backup codes, and security questions.

Every recovery option is effectively a second way to log in. Its security is only as strong as its weakest link.', 'Attackers often skip your strong password and attack the weaker recovery path instead. A carefully protected main account can still be lost if its recovery email is an old, unsecured inbox.

Recovery planning is also about resilience. If you lose your phone and your only MFA method is on it, you may be locked out of your own accounts for weeks.', 'If your recovery email is old or insecure, or your security answers are on social media, an attacker can reset your password. Recovery phone numbers can be hijacked by SIM swaps.

Security questions are especially risky because many answers are public or guessable: schools, pets, hometowns, and family names. Treat the answer as a password, not as a fact about your life.

A good recovery setup uses strong, separate recovery methods, keeps them up to date, and stores backup codes in a safe place that you can reach when you need them.', 'Lina''s security question was "Mother''s maiden name." Her mother''s maiden name appears in public family posts, so an attacker answered it and reset her account. Lina''s password was strong, but her recovery path was the weak point.', '- Keep recovery emails and phone numbers current and secured with MFA.
- Treat security questions like passwords: use random answers stored in your password manager.
- Store backup codes offline.
- Ask your mobile carrier about a SIM/port-out PIN or lock if offered.
- Remove old recovery addresses or phone numbers you no longer control.', '[{"question":"Why do attackers target recovery options?","options":["They are often weaker than the main password","They are encrypted","They are illegal to use","They expire"],"answer":0,"explanation":"A weak recovery path bypasses a strong password."},{"question":"A good answer to a security question is:","options":["The true, public answer","A random answer saved in your password manager","Your birthday","Leave it blank"],"answer":1,"explanation":"True answers are often findable; random ones are not."},{"question":"Backup codes should be stored:","options":["In a public post","Somewhere safe, such as offline or in your password manager","In your email subject line","Nowhere"],"answer":1,"explanation":"They are a key to your account and must be kept private."}]'),
  (5, 'Credential Stuffing and Brute-Force Attacks', '- Brute force: trying many possible passwords until one works.
- Credential stuffing: taking email/password pairs leaked from one site and automatically trying them on other sites.

Both are automated. They rely on volume and on the fact that many people reuse or choose predictable passwords.', 'Huge lists of leaked credentials circulate online. If you reuse passwords, stuffing can unlock your accounts without any guessing.

Brute-force attacks against weak or common passwords are also quick when attackers have a database of password hashes. Protecting against both problems starts with unique, long passwords and MFA.', 'Online attacks against a login page are slowed by rate limits and lockouts. Offline attacks happen when attackers steal a database of password hashes and guess at very high speed on their own hardware, which is why long unique passwords matter. Stuffing uses bots that rotate IP addresses to avoid detection.

Because the attacker is only testing pairs that already worked somewhere, a stuffing attack often succeeds on accounts that were never individually targeted. It also tends to produce waves of login attempts that you may notice as unexpected login alerts.

Credential stuffing is one of the clearest examples of why unique passwords are valuable: a leak only affects the site where it happened.', 'A streaming service notices thousands of logins from different IPs, each using credentials leaked from an unrelated site. Accounts with reused passwords are hijacked and resold. Users with unique passwords are unaffected, even though their old passwords were in the same leaked list.', '- Use unique passwords everywhere (password manager).
- Enable MFA.
- Check breach-notification services such as Have I Been Pwned for your email.
- Change any password that appears in a known breach.
- Watch for login alerts from places or devices you do not recognize.', '[{"question":"Credential stuffing relies mainly on:","options":["Password reuse","Long passphrases","MFA","Encryption"],"answer":0,"explanation":"It reuses leaked pairs on other sites."},{"question":"An \"offline\" attack means attackers:","options":["Must be at your house","Guess against stolen password hashes on their own hardware","Need your phone","Use only email"],"answer":1,"explanation":"Offline guessing is not slowed by website lockouts."},{"question":"Best single defense against credential stuffing?","options":["Unique passwords per site","Changing your username","Clearing cookies","Using incognito"],"answer":0,"explanation":"A leaked password from one site will not work elsewhere."}]'),
  (6, 'Protecting Your Digital Identity', 'Your digital identity is the set of accounts, identifiers, and records that prove who you are online: email, phone number, government IDs, financial accounts, and social profiles.

Identity theft happens when someone uses those pieces to pretend to be you. It can involve new accounts opened in your name, loans, or fraud that appears on records you never see.', 'Identity theft lets criminals open accounts, take loans, or commit fraud in your name, and it can take a long time to clean up.

Because your identity is reused across many services, a single successful theft can affect many areas of your life at once. Early detection and careful sharing of documents are therefore some of the most valuable habits you can build.', 'Thieves combine leaked data, phishing, and public information. Photos of IDs, selfies holding IDs, and copies sent over chat are especially valuable to them. A complete identity record often includes a name, birthday, address, and ID number, and a single document can supply several of these at once.

Documents are often shared in ways that are hard to control. Once a copy is in a chat, an email inbox, or a shared folder, you cannot know who else can access it. That is why sharing only with verified organizations, and only when really necessary, is so important.

Regularly checking statements and credit information, where available, lets you catch unfamiliar accounts and inquiries early.', 'Rafa sends a photo of his ID to a "seller" to "verify" a marketplace deal. The image is later used in an attempt to open an online loan account. Rafa only noticed when a verification code arrived for an account he never opened, which he then reported to the lender and his e-wallet provider.', '- Share ID copies only with verified organizations, and watermark them with the purpose and date when possible.
- Monitor bank and e-wallet statements and enable transaction alerts.
- Use a separate email for important accounts.
- Where available in your country, consider credit monitoring or a credit freeze.
- Shred or securely delete old paper copies of IDs you no longer need.', '[{"question":"Which is most valuable to an identity thief?","options":["A weather app","A photo of your government ID","Your favorite color","A public news article"],"answer":1,"explanation":"ID images can be used to impersonate you."},{"question":"Watermarking an ID copy helps by:","options":["Making it illegal to view","Limiting reuse for other purposes","Encrypting it","Deleting it later"],"answer":1,"explanation":"A purpose/date watermark makes misuse harder and more obvious."},{"question":"Transaction alerts help you:","options":["Spend more","Spot unauthorized activity quickly","Avoid MFA","Hide accounts"],"answer":1,"explanation":"Early detection limits damage."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 3
on conflict (module_id, lesson_order) do nothing;

-- Module 4
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Operating System Updates', 'Updates are fixes and improvements from your device or software maker, including security patches for known flaws.

An update is often the only way to close a vulnerability that the software maker has already discovered. Until you install it, the flaw remains available to anyone who knows how to use it.', 'Once a flaw is publicly fixed, attackers can study the patch and target devices that have not updated. The gap between a fix being released and devices being updated is a window that attackers actively exploit.

Updates also cover browsers, drivers, and apps, not just the operating system. Many serious incidents involve flaws in software people rarely think about.', 'Patches close vulnerabilities in the operating system, browser, and apps. Devices that no longer receive security updates ("end of life") stay vulnerable permanently.

Automatic updates are the simplest way to keep the gap small, because they do not depend on remembering. When an update requires a restart, delaying it for days leaves the patch unapplied even though it has been downloaded.

It is also worth checking the support date of older devices. A phone or computer that no longer receives patches should be replaced or used only for low-risk tasks.', 'A ransomware campaign spreads through a flaw that was patched months earlier. Updated computers are unaffected; unpatched ones are encrypted. The organization that was hit had delayed updates to avoid disrupting work, and the delay gave attackers a predictable path into the network.', '- Turn on automatic updates for your OS, browser, and apps.
- Restart when prompted so updates finish installing.
- Check whether your phone or computer still receives security updates.
- Uninstall apps you no longer use.
- Replace devices that have reached end of support when you can.', '[{"question":"Why delay in updating is risky:","options":["Updates slow devices","Attackers target known, already-fixed flaws","Updates delete data","It is not risky"],"answer":1,"explanation":"Published fixes reveal what to attack on unpatched devices."},{"question":"An \"end-of-life\" device:","options":["Gets extra updates","No longer receives security patches","Is always safe","Is brand new"],"answer":1,"explanation":"Without patches, new flaws stay open."},{"question":"Which should be updated?","options":["Only the OS","OS, browser, and apps","Only games","Nothing"],"answer":1,"explanation":"Any software can contain vulnerabilities."}]'),
  (2, 'Malware, Spyware, Ransomware, and Trojans', '- Malware: any malicious software.
- Spyware: secretly monitors activity, messages, or location.
- Ransomware: encrypts or locks your files and demands payment.
- Trojan: malware disguised as something useful.

These categories overlap. A single program can be a trojan that delivers spyware, and ransomware is often installed by other malware first.', 'Malware can steal passwords and money, spy on you, or destroy your files. Some types are designed to stay hidden for weeks, collecting information quietly.

Because malware can be installed without obvious signs, prevention and early detection matter more than cleanup. Good habits reduce the number of chances malware has to get in.', 'Malware usually arrives through phishing attachments, fake or pirated software, malicious ads, or apps from unofficial sources. Stalkerware may be installed by someone with physical access to your phone.

Signs of infection can include slow performance, unexpected pop-ups, new apps you did not install, strange battery drain, or unusual data use. Many signs are subtle, so noticing changes in your normal behavior is useful.

Ransomware is especially damaging because it targets your files directly. Keeping offline or versioned backups is the most reliable way to recover without paying.', 'A free "video downloader" from an unofficial site works as promised but also installs a password-stealing trojan. The user did not notice anything wrong, because the downloader still worked. Only later, when a bank login was reported as suspicious, did the user connect the two events.', '- Install software only from official stores or developer sites.
- Avoid pirated software and "cracks."
- Keep devices updated and use built-in security tools.
- Keep backups to recover from ransomware.
- Be cautious of ads that promise free downloads or urgent software fixes.', '[{"question":"A trojan is malware that:","options":["Spreads only by USB","Disguises itself as legitimate software","Only affects phones","Is harmless"],"answer":1,"explanation":"Like the Trojan horse, it hides inside something wanted."},{"question":"Ransomware typically:","options":["Shows ads","Encrypts files and demands payment","Speeds up your PC","Updates apps"],"answer":1,"explanation":"It holds your data hostage."},{"question":"A common malware source is:","options":["Official app stores","Pirated software and cracks","OS updates","Your password manager"],"answer":1,"explanation":"Cracked software is a common carrier for malware."}]'),
  (3, 'Antivirus and Endpoint Protection', 'Antivirus and endpoint protection software detect and block known and suspicious malicious activity on your device.

Endpoint protection is a broader term used for protection on laptops, phones, and servers. It often includes monitoring, firewall features, and tools that let you review what happened.', 'It is a safety net that can catch threats your other habits miss. No one can avoid every risky click, and a good protection layer can stop a mistake from becoming a disaster.

It also provides alerts that help you notice compromise early, which is valuable for everyone, not only for technical users.', 'Modern tools combine signature detection (known malware) with behavior monitoring (suspicious actions, such as mass file encryption). Windows includes Microsoft Defender, and macOS includes built-in protections such as XProtect and Gatekeeper.

Signature detection is effective against known threats but misses new ones. Behavior monitoring helps catch unknown threats by focusing on what a program does, such as rapidly changing many files or disabling security settings.

The built-in tools are a solid baseline for most people. Installing third-party products is optional, but avoid running several real-time scanners at once, because they can conflict and slow the device.', 'An employee opens a malicious attachment. Endpoint protection detects the file trying to encrypt documents and stops the process. The alert gives IT a chance to isolate the device and investigate before the damage spreads.', '- Keep built-in protection turned on and updated.
- Run only one real-time antivirus to avoid conflicts.
- Do not disable protection because a download "asks" you to.
- Look at alerts rather than ignoring them.
- Remember it is a layer, not a guarantee.', '[{"question":"Behavior-based detection looks for:","options":["File names only","Suspicious actions like mass encryption","Your password","Screen brightness"],"answer":1,"explanation":"It flags malicious behavior even from unknown files."},{"question":"A download that asks you to disable antivirus is:","options":["Normal","A strong warning sign","Required","Safer"],"answer":1,"explanation":"Malware often tries to switch off protection."},{"question":"Antivirus should be treated as:","options":["A complete solution","One layer of defense","Unnecessary","A replacement for updates"],"answer":1,"explanation":"Defense in depth uses several layers."}]'),
  (4, 'Disk Encryption', 'Full-disk encryption scrambles everything stored on a device so it can only be read after you unlock it with your password, PIN, or key.

It protects data "at rest," meaning files sitting on a device that is turned off or locked. It does not protect data that is already open and accessible on an unlocked device.', 'If your laptop or phone is lost or stolen, encryption keeps your files private. Without it, anyone with physical access can often remove the storage and read it with another computer.

For most people, disk encryption is one of the easiest and most effective protections to turn on, and modern devices often offer it by default.', 'Modern phones encrypt storage when a passcode is set. Computers use tools such as BitLocker or Device Encryption (Windows) and FileVault (macOS). Protection applies when the device is powered off or locked; a stolen unlocked device is still exposed.

Recovery keys are the most important detail to handle carefully. Encryption works because the key is protected, and the recovery key is the backup way in if you forget your password. Store it somewhere safe that is separate from the device.

A short auto-lock timeout and a strong passcode make encryption more effective, because a locked device requires the passcode to decrypt its contents.', 'Two laptops are stolen from a car. One has FileVault enabled; its data is unreadable. The other is unencrypted, and the thief can remove the drive and read every file. The owners later discovered that the unencrypted laptop also held saved passwords for their work accounts.', '- Set a strong passcode on your phone.
- Turn on BitLocker/Device Encryption or FileVault.
- Store the recovery key safely; losing it can mean losing your data.
- Lock or shut down devices when unattended.
- Keep a short auto-lock timeout on phones and laptops.', '[{"question":"Disk encryption mainly protects data when:","options":["The device is lost or stolen","You are browsing","You send email","You charge it"],"answer":0,"explanation":"It protects data at rest on the device."},{"question":"FileVault is the built-in encryption for:","options":["Windows","macOS","Android","Routers"],"answer":1,"explanation":"FileVault is Apple''s macOS disk encryption."},{"question":"Why store the recovery key safely?","options":["It is decorative","Without it, you may permanently lose access to your data","It speeds up boot","It is not needed"],"answer":1,"explanation":"The recovery key is your backup way in."}]'),
  (5, 'USB Safety', 'USB devices, including flash drives and cables, can carry malware or be built to act maliciously when plugged in.

A USB device is not just storage. Some devices can present themselves to your computer as a keyboard or a network adapter, which gives them far more control than a file would have.', 'Unknown USB drives have been used to deliver malware, and some devices can pretend to be a keyboard and type commands.

The risk is strongest when the device comes from an unknown source, such as a conference giveaway, a parking-lot find, or an unexpected package. Curiosity is the main reason people plug in unknown drives.', 'A drive can contain infected files. Specially built devices can emulate a keyboard and run commands within seconds. Public charging ports carry a theoretical risk of data access ("juice jacking"), which charge-only cables or your own adapter avoid.

Modern operating systems have reduced automatic running of drives, but the safest rule is still to avoid connecting untrusted hardware. If you must inspect a drive, use a dedicated, isolated computer and follow your organization''s procedures.', 'A USB drive labeled "Salaries 2026" is left in a company parking lot. A curious employee plugs it in, and it installs remote-access malware. Because the drive used a tempting name, the employee assumed it was an internal file and did not think twice before connecting it.', '- Never plug in USB drives you found or did not expect.
- Use your own charger and power adapter, or a charge-only cable, in public places.
- Disable autorun features and scan removable drives.
- Give found drives to IT, not your computer.
- Be cautious of USB accessories you did not buy from a known seller.', '[{"question":"You find a USB drive in a parking lot. You should:","options":["Plug it in to find the owner","Hand it to IT/security without plugging it in","Keep it","Format it on your PC"],"answer":1,"explanation":"Found drives are a known attack method."},{"question":"Some malicious USB devices can:","options":["Only store photos","Pretend to be a keyboard and type commands","Charge faster","Fix viruses"],"answer":1,"explanation":"Keystroke-injection devices act like keyboards."},{"question":"A safer way to charge in public is:","options":["Any unknown cable","Your own adapter and cable, or a charge-only cable","Bluetooth","Borrowing a stranger''s laptop"],"answer":1,"explanation":"Using your own power adapter avoids data connections."}]'),
  (6, 'Secure Device Configuration', 'Secure configuration means adjusting device settings to reduce risk: screen lock, app permissions, Bluetooth, sharing settings, and installed apps.

Most devices ship with settings chosen for ease of use. Reviewing them once, and again after major updates, is a practical way to close gaps you did not know existed.', 'Default settings often favor convenience over privacy and security. A feature that is useful in one situation may be a risk in another.

Even small changes, like shortening the auto-lock time or limiting background location, can significantly reduce what a thief or stalker can see.', 'Every enabled feature or permission is a possible way in. Reducing unnecessary permissions and services shrinks your "attack surface."

A practical approach is to review settings in groups: lock and login, permissions, connectivity, sharing, and installed apps. For each, ask whether you actually use the feature. If you do not, turn it off. If you do, make sure it is limited to the people or situations you intend.

Revisit these settings after new apps, new devices, or operating system upgrades, because new versions sometimes reset or add options.', 'A flashlight app requests access to contacts, location, and the microphone. None are needed for a flashlight, so the request is a red flag. The user removed the app and checked other installed apps for similar unnecessary permissions, which revealed two more to remove.', '- Use a strong screen lock and short auto-lock time.
- Review app permissions (location, camera, microphone, contacts) regularly.
- Turn off Bluetooth, AirDrop/Nearby Share, and file sharing when not needed, or limit them to contacts.
- Remove unused apps.
- Enable "Find My" or "Find My Device."', '[{"question":"\"Attack surface\" refers to:","options":["Screen size","All the ways a system could be attacked","Battery life","Case material"],"answer":1,"explanation":"Fewer features and permissions mean fewer entry points."},{"question":"A flashlight app asking for contacts access is:","options":["Necessary","A red flag","Required by law","Normal for all apps"],"answer":1,"explanation":"Permissions should match what the app actually does."},{"question":"Which helps if your phone is lost?","options":["Disabling the lock","Enabling Find My / Find My Device","Turning off updates","Removing the SIM PIN"],"answer":1,"explanation":"It lets you locate, lock, or erase the device."}]'),
  (7, 'Physical Device Security', 'Physical security means protecting devices from being stolen, tampered with, or viewed by others.

Digital protections assume the attacker cannot touch the device. Physical security covers the cases where they can, which includes cafés, offices, cars, and shared homes.', 'Someone with physical access can read your screen, install stalkerware, or steal the device itself. Physical access can also bypass many software protections if the device is left unlocked or unattended.

In some situations, such as shared households or relationships with coercive control, physical access is the main threat, which makes this lesson especially important.', 'Risks include shoulder surfing, unattended unlocked devices, theft in public places, and tampering. Encryption and screen locks reduce the damage; awareness prevents many incidents.

Simple habits, such as keeping devices in a bag or pocket in crowded places, using a privacy screen, and locking the screen before you turn away, prevent most opportunistic incidents.

Tampering can be subtle. Watch for devices that feel different, unfamiliar cables or accessories, or apps and profiles you did not install.', 'At a café, a person behind Mia watches her type her phone PIN, then later snatches the phone and unlocks it. Mia had left her phone on the table while she went to the counter, and the PIN had been visible for the whole time she typed it.', '- Lock your screen whenever you step away (Windows+L, Ctrl+Cmd+Q on Mac).
- Shield your PIN and password entry in public.
- Consider a privacy screen filter.
- Never leave devices unattended in public.
- Watch for signs of tampering or unknown apps.', '[{"question":"Shoulder surfing is:","options":["A water sport","Watching someone''s screen or keypad to steal information","A Wi-Fi attack","A type of malware"],"answer":1,"explanation":"It is visual spying in person."},{"question":"The keyboard shortcut to lock a Windows PC is:","options":["Ctrl+C","Windows+L","Alt+F4","Ctrl+Z"],"answer":1,"explanation":"Windows+L locks the screen immediately."},{"question":"Physical access can allow someone to:","options":["Nothing important","Install stalkerware or steal data","Only charge it","Update it"],"answer":1,"explanation":"Physical access is often enough to compromise a device."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 4
on conflict (module_id, lesson_order) do nothing;

-- Module 5
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'How the Internet Works', 'The internet is a global network of networks that sends data in small packets between devices using shared rules called protocols (such as TCP/IP).

No single company or computer carries your data from start to finish. Your information is split into packets, which can take different routes, and reassembled at the destination.', 'Understanding the basics shows where your data travels and who can see it along the way. Many privacy and security decisions become clearer once you know which parties are involved in each connection.

It also explains why some protections, like encryption, matter so much: the path crosses many networks you do not control.', 'Your device connects to a router, then to your internet service provider (ISP), then through many other networks to the server. DNS translates names like example.com into IP addresses. Without encryption, anyone along the path could read the data; with HTTPS, they mostly see where you connect, not what you send.

Think of each hop as a potential observer. Your home router and ISP see the connection; the networks in between may see the destination address; and the website sees everything you send it. Encryption protects content on the route but not the basic fact that a connection occurred.

Understanding this model helps you judge when a risk is about the network, when it is about the website, and when it is about your own device.', 'When Joy visits her bank''s website, her request passes her home router, her ISP, and several other networks before reaching the bank. HTTPS keeps the content private along that route. Joy knows her ISP can still see that she connected to the bank, so she relies on her bank''s own protections for the rest of her account security.', '- Use HTTPS sites (most browsers can warn or upgrade automatically).
- Remember that your network provider can usually see which sites or services you connect to.
- Keep your home router secure (see the router lesson).
- Remember that encryption protects content, not every detail of a connection.', '[{"question":"DNS is used to:","options":["Encrypt email","Translate domain names into IP addresses","Block ads","Store passwords"],"answer":1,"explanation":"DNS is like the internet''s address book."},{"question":"Data travels across the internet in:","options":["One big file","Small packets","Radio only","Letters"],"answer":1,"explanation":"Data is split into packets and reassembled."},{"question":"With HTTPS, your ISP can generally see:","options":["Your passwords","Which site you connect to, but not page contents","Everything you type","Nothing at all"],"answer":1,"explanation":"HTTPS hides contents, but connection metadata is still visible."}]'),
  (2, 'Public Wi-Fi Risks', 'Public Wi-Fi is any network shared with strangers: cafés, airports, hotels, malls.

Some public networks are run by businesses, some are run by individuals, and some are set up specifically to capture information. From the device''s point of view, they can look almost identical.', 'You do not control the network, and you do not know who else is on it. A convenient connection can quickly become a way to watch or manipulate your traffic.

The risk is less about someone reading your messages on a well-encrypted site and more about fake sign-in pages, fake networks, and unpatched devices that other users bring to the same network.', 'Risks include fake "evil twin" hotspots with convincing names, fake captive-portal login pages, and attacks against devices on the same network. Widespread HTTPS has reduced the risk of simple eavesdropping, but fake portals and unpatched devices are still concerns.

Devices often reconnect automatically to networks they have seen before, which means a convincing fake with a familiar name can capture your device without you choosing it. Turning off auto-join for public networks helps.

A captive portal that asks for your email or social media password is always a strong warning sign, because legitimate hotels and cafés only need you to accept terms or enter a room code.', 'At an airport, Leo connects to "Airport_Free_WiFi_Fast." It is a hotspot run from someone''s laptop that shows a fake login page asking for his email password. Leo noticed the page asked for an email password instead of a room code or terms acceptance, and closed it before entering anything.', '- Confirm the official network name with staff.
- Never enter account passwords on a Wi-Fi sign-in page.
- Prefer your mobile data or hotspot for sensitive tasks.
- Set public networks as "Public" so file sharing is off.
- Forget networks after use to avoid auto-reconnecting.', '[{"question":"An \"evil twin\" is:","options":["A backup router","A fake hotspot imitating a real one","A VPN","A firewall rule"],"answer":1,"explanation":"It lures users with a familiar or appealing name."},{"question":"A Wi-Fi sign-in page asks for your email password. You should:","options":["Enter it","Refuse; that is not normal","Use a different password","Restart"],"answer":1,"explanation":"Captive portals should not need your account credentials."},{"question":"For banking on the go, a safer option is usually:","options":["Any open Wi-Fi","Your mobile data","A shared computer","An unknown hotspot"],"answer":1,"explanation":"Mobile data avoids the shared network."}]'),
  (3, 'VPNs: What They Do and Don''t Do', 'A VPN (Virtual Private Network) creates an encrypted tunnel between your device and a VPN server, which then connects to websites for you.

From the websites'' point of view, the connection appears to come from the VPN server. From your local network''s point of view, your traffic looks like a single encrypted connection to the VPN.', 'VPNs are often marketed as complete privacy solutions. Knowing their limits avoids false confidence.

A VPN can be useful for specific purposes, such as protecting traffic on an untrusted network or accessing work resources. It is not a substitute for strong accounts, updated devices, or careful behavior.', 'A VPN hides your traffic from the local network and your ISP and shows websites the VPN''s IP address instead of yours. However, the VPN provider can now see your connection metadata, so you shift trust to them. A VPN does not stop phishing, malware, tracking by logged-in accounts, or browser fingerprinting, and it does not make you anonymous.

When you choose a VPN, consider who operates it, where it is based, whether it has been independently audited, and how it handles logs. Free services often earn money in ways that conflict with privacy.

A VPN and HTTPS do different jobs. HTTPS protects the content of a connection to a specific site, while a VPN protects the path between you and the VPN server.', 'Nico uses a VPN on café Wi-Fi, which protects him from the local network. He is still tracked by the social site he is logged into, and a VPN would not have stopped the phishing link he nearly clicked. The VPN helped with one risk, and his other habits handled the rest.', '- Use a VPN when you do not trust the local network, or for work access if required.
- Choose a reputable provider with a clear privacy policy and independent audits; be cautious of free VPNs that monetize your data.
- Do not rely on a VPN for anonymity or malware protection.
- Keep your VPN app and device updated.', '[{"question":"A VPN mainly protects you from:","options":["Phishing","The local network and ISP seeing your traffic","All tracking","Malware"],"answer":1,"explanation":"It encrypts traffic between you and the VPN server."},{"question":"When you use a VPN, who can see your connection metadata?","options":["No one","The VPN provider","Only you","Only the website"],"answer":1,"explanation":"You shift trust from your ISP to the VPN provider."},{"question":"Does a VPN make you anonymous?","options":["Yes, completely","No; logins, cookies, and fingerprinting still identify you","Only on weekends","Only on mobile"],"answer":1,"explanation":"Many tracking methods do not depend on your IP address."}]'),
  (4, 'DNS and HTTPS', '- DNS converts names (example.com) into IP addresses.
- HTTPS is HTTP secured with TLS encryption, protecting data between your browser and a website.

Together they answer two questions: "Where is this site?" and "Is my conversation with it private?"', 'Unprotected DNS can reveal which sites you visit and can be manipulated; HTTPS prevents eavesdropping and tampering with page contents.

However, each protects a different part of the process. A secure connection to the wrong server still delivers the wrong site, so understanding both is necessary for judging whether a page is trustworthy.', 'Traditional DNS queries are unencrypted. DNS over HTTPS (DoH) and DNS over TLS (DoT) encrypt them. HTTPS uses certificates to prove the server controls the domain, but a certificate does not prove the site is honest; scammers can get certificates for their own look-alike domains.

When your browser shows a certificate error, it is telling you that it cannot verify the server''s identity. This can happen for innocent reasons, such as an expired certificate, but it can also signal interception. Stopping is the safe choice for sensitive sites.

Encrypted DNS hides your lookups from the local network, but the DNS provider still sees them, so choose a provider you trust.', 'On a compromised network, an attacker tampers with DNS so a bank name resolves to a fake server. Because the attacker cannot get a valid certificate for the real bank domain, the browser shows a certificate warning, which the user should not bypass. The user closed the tab, navigated to the bank through a bookmark, and checked for alerts.', '- Do not click through certificate warnings on sensitive sites.
- Enable "HTTPS-Only" or "Always use secure connections" in your browser.
- Consider enabling encrypted DNS (DoH) in your browser or OS.
- Remember: padlock = encrypted connection, not proof of legitimacy.', '[{"question":"DNS over HTTPS (DoH) does what?","options":["Speeds up downloads","Encrypts DNS queries","Blocks all ads","Replaces passwords"],"answer":1,"explanation":"It hides DNS lookups from the local network."},{"question":"A certificate warning on your bank''s site means you should:","options":["Click \"proceed anyway\"","Stop and not continue","Refresh until it disappears","Disable HTTPS"],"answer":1,"explanation":"It may indicate interception or a fake site."},{"question":"HTTPS proves that:","options":["The site is honest","The connection is encrypted to the server for that domain","The site has no malware","The site is government-approved"],"answer":1,"explanation":"It authenticates the domain, not the owner''s intentions."}]'),
  (5, 'Router Security', 'Your home router connects your devices to the internet and is the front door of your home network.

It also manages the network inside your home, including how devices find each other and which services are reachable. Because it sits between everything you own and the internet, its security affects every device on it.', 'A compromised router can redirect traffic, spy on devices, or be used in botnets. Routers are often forgotten after setup, so their software and passwords can remain unchanged for years.

A secure router protects smart devices, computers, and phones at the same time, which makes it one of the highest-leverage places to improve security.', 'Routers often ship with default admin passwords, outdated firmware, and features such as WPS or remote management turned on. Attackers scan the internet for routers with these weaknesses.

Firmware updates close known flaws, but many routers stop receiving updates after a few years. Replacing an unsupported router is often the most effective upgrade.

Segmenting your network is also valuable. A guest network or separate network for smart devices limits what a compromised gadget can reach, such as your computers or files.', 'An old router still uses the default admin password printed on its label. Malware logs in, changes its DNS settings, and sends household devices to fake websites. The household only noticed when a bank page looked slightly wrong, which prompted a check of the router settings.', '- Change the router admin password from the default.
- Update firmware, or replace routers that no longer receive updates.
- Use WPA3, or WPA2-AES if WPA3 is unavailable, with a strong Wi-Fi password.
- Disable WPS and remote administration if you do not need them.
- Use a separate guest network for visitors and smart devices.', '[{"question":"Which Wi-Fi security setting is best if supported?","options":["WEP","Open","WPA3","WPS"],"answer":2,"explanation":"WPA3 is the current standard; WEP is broken."},{"question":"Why change the router''s default admin password?","options":["Defaults are often known or easy to find","It increases speed","It is decorative","It updates firmware"],"answer":0,"explanation":"Attackers try default credentials automatically."},{"question":"A guest network is useful for:","options":["Making Wi-Fi faster","Separating visitors and smart devices from your main devices","Removing passwords","Disabling updates"],"answer":1,"explanation":"Segmentation limits what a compromised device can reach."}]'),
  (6, 'Network Sniffing and Man-in-the-Middle Attacks', '- Sniffing: capturing network traffic to read it.
- Man-in-the-middle (MITM): secretly sitting between two parties to read or alter their communication.

Sniffing is passive listening. A MITM attack goes further by inserting the attacker into the conversation, which allows them to change what is sent.', 'Unencrypted traffic can reveal passwords, messages, and session data.

Even encrypted traffic can be intercepted in ways that matter. A MITM attacker who can present a fake certificate, or who can get a user to accept one, may still be able to read data. This is why certificate warnings are so important.', 'On shared networks, attackers can try ARP spoofing, rogue access points, or DNS tampering to position themselves in the middle. Encryption such as HTTPS and certificate checks make intercepted data unreadable and reveal many tampering attempts.

A useful way to think about it: encryption protects the message, and certificate validation protects the identity of the other party. Both are needed. Ignoring a certificate warning removes the second protection while leaving the first one in place only for the attacker.

MITM is less common against well-configured HTTPS sites, but it still appears on compromised networks and in targeted attacks.', 'At a conference, an attacker sets up a rogue access point. Users who ignore certificate warnings on a login page have their credentials captured. The attackers did not break the encryption; they simply presented a fake certificate that the users accepted.', '- Use HTTPS everywhere and heed certificate warnings.
- Prefer trusted networks or mobile data for sensitive activity.
- Keep devices updated.
- Use a VPN on networks you do not trust.
- Avoid entering passwords when your browser or app warns about an unexpected certificate.', '[{"question":"A man-in-the-middle attacker:","options":["Breaks your screen","Secretly intercepts communication between two parties","Only sends spam","Repairs networks"],"answer":1,"explanation":"They sit between you and the destination."},{"question":"What makes sniffed traffic far less useful?","options":["Encryption such as HTTPS","A bigger screen","Faster Wi-Fi","Bluetooth"],"answer":0,"explanation":"Encrypted data is unreadable without keys."},{"question":"A certificate warning during login might indicate:","options":["A normal page","Possible interception","A faster site","A software update"],"answer":1,"explanation":"MITM attempts often trigger certificate errors."}]'),
  (7, 'Firewall Fundamentals', 'A firewall controls which network connections are allowed into or out of a device or network, based on rules.

A firewall does not decide whether content is safe. It decides which connections are permitted, based on where they come from, where they are going, and which service or program is involved.', 'It blocks unwanted incoming connections that could exploit services on your device.

Most people never think about firewalls until something goes wrong. Keeping them on is one of the least effortful protections available, and it matters most on networks you do not control.', 'Your router typically blocks unsolicited incoming connections from the internet. Operating systems include host firewalls (Windows Defender Firewall, macOS Application Firewall) that can block apps or services, especially on public networks.

There are two layers in most homes. The router firewall stops many unsolicited connections from outside. The host firewall protects each device, including from other devices on the same network. Both layers add value.

When you approve an app that asks to accept incoming connections, consider whether you recognize the app and whether you need that connection at all.', 'A laptop with file sharing turned on joins hotel Wi-Fi. Because the network is set to "Public," the firewall blocks other guests from reaching the shared folders. The owner had not realized the folders were shared until the network profile was reviewed.', '- Keep your OS firewall turned on.
- Mark untrusted networks as Public.
- Only allow apps through the firewall when you understand why.
- Avoid opening router ports unless necessary.
- Review firewall rules occasionally, especially after installing new software.', '[{"question":"A firewall''s job is to:","options":["Speed up the internet","Allow or block connections based on rules","Store passwords","Scan photos"],"answer":1,"explanation":"It filters network traffic."},{"question":"Setting a network to \"Public\" usually:","options":["Turns off security","Applies stricter firewall rules and disables sharing","Shares your files","Disables Wi-Fi"],"answer":1,"explanation":"Public profiles are more restrictive."},{"question":"Opening router ports should be done:","options":["Always","Only when necessary and understood","Never possible","For speed"],"answer":1,"explanation":"Each open port exposes a service to the internet."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 5
on conflict (module_id, lesson_order) do nothing;

-- Module 6
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Browser Fingerprinting', 'Browser fingerprinting identifies your browser by combining many small details: screen size, fonts, time zone, language, graphics hardware, and settings.

No single detail is unique, but the combination often is. Fingerprinting works without storing anything on your device, which is why clearing cookies does not reset it.', 'It can track you across sites even without cookies and even when you change IP address. This makes it harder to control than cookie-based tracking, because it relies on characteristics you cannot easily change.

Understanding fingerprinting also explains why some privacy advice, like installing many extensions, can backfire.', 'Each detail is common, but the combination can be rare enough to recognize you. Scripts collect these values and compute an identifier. Some browsers reduce fingerprinting by standardizing or randomizing values.

Browsers that try to look like many others are often more effective than browsers that give you many custom settings, because uniformity makes you harder to single out. Randomizing values can also work, but it can create inconsistencies that trackers detect.

Complete protection is difficult. The realistic goal is to reduce how much unique information you expose and to avoid behaviors that make your browser stand out.', 'Sam clears cookies daily and uses a VPN, yet ad networks still recognize his browser because its combination of fonts, extensions, and settings is unusual. Sam realized that his heavily customized setup was the main reason he stood out, not the cookies he had been clearing.', '- Use a browser with fingerprinting protections (for example, Firefox, Brave, or Tor Browser).
- Avoid installing many unusual extensions, which can make you more unique.
- Keep browser privacy protections enabled.
- Accept that complete protection is difficult.
- Prefer default settings where they are reasonable, since they are shared by many users.', '[{"question":"Fingerprinting can track you:","options":["Only with cookies","Even without cookies","Only offline","Only on phones"],"answer":1,"explanation":"It uses device and browser characteristics instead of stored files."},{"question":"Installing many rare extensions may:","options":["Make you less unique","Make your fingerprint more unique","Have no effect","Block all tracking"],"answer":1,"explanation":"Unusual configurations stand out."},{"question":"A VPN alone stops fingerprinting:","options":["True","False"],"answer":1,"explanation":"Fingerprinting does not rely on your IP address."}]'),
  (2, 'Cookies and Tracking', 'Cookies are small files websites store in your browser. First-party cookies come from the site you visit (keeping you logged in); third-party cookies come from other domains, often advertisers, and can track you across sites.

Not all cookies are harmful. Many are needed for shopping carts, logins, and preferences. The concern is with cookies that follow you from site to site to build a profile.', 'Tracking builds detailed profiles of your interests, habits, and sometimes sensitive topics. Those profiles can be used for advertising, sold to data brokers, or exposed in a breach.

Because sensitive topics such as health, finances, and relationships can appear in browsing patterns, tracking can reveal far more than you intended to share.', 'Trackers use cookies, pixels, scripts, and logged-in accounts to link your activity. Some browsers block many third-party cookies by default, but trackers also use other techniques, such as local storage and fingerprinting.

Consent banners often offer choices about tracking. Rejecting non-essential cookies, where the option is clearly available, reduces how much third parties can collect.

Logging into a large platform while browsing other sites is a powerful tracking signal, because it ties your activity to a real identity.', 'After reading about a medical condition on a health site, Nina sees related ads on unrelated websites and social media. She had not been logged in to any of those services, but a shared advertising network linked the visits anyway.', '- Block third-party cookies in your browser settings.
- Use tracker-blocking browsers or reputable extensions.
- Reject non-essential cookies in consent banners.
- Log out of, or separate, accounts used for sensitive browsing.
- Clear site data for sites you no longer use.', '[{"question":"Third-party cookies are mainly used for:","options":["Keeping you logged in on the same site","Tracking across different sites","Encrypting traffic","Speeding up pages"],"answer":1,"explanation":"They are set by domains other than the one you are visiting."},{"question":"A tracking pixel is:","options":["A screen defect","A tiny embedded image or script that reports your visit","A password","A firewall"],"answer":1,"explanation":"Pixels quietly signal that content was loaded."},{"question":"Being logged into a large platform while browsing can:","options":["Prevent tracking","Help that platform link your activity","Delete cookies","Hide your IP"],"answer":1,"explanation":"Logged-in identity is a strong tracking signal."}]'),
  (3, 'Search Engine Privacy', 'Search engines can log your queries, IP address, and clicks, and link them to your account.

A search box is one of the most candid places people type. Queries often reveal what someone is worried about, planning, or curious about, even when they would never say it aloud.', 'Searches can reveal health concerns, finances, relationships, and plans. Over time, a search history can build a detailed picture of your life.

Because search history can persist, a query made during a stressful moment may remain visible in your account long after you have forgotten it.', 'Search history may be stored and used for personalization and ads. Privacy-focused search engines (for example, DuckDuckGo, Startpage, or Brave Search) say they do not build personal search profiles. Check each provider''s current policy.

Signed-in searches are the most identifiable, because the account links every query to you. Searching while logged out, or using a privacy-focused engine for sensitive topics, reduces that link.

No search engine can make a query fully private. Your provider, your network, and the sites you visit can still see some of what you do.', 'Tom searches for symptoms and loan options while logged into his account. That history is saved and visible to anyone who later accesses his account, including a family member who borrows his computer. Tom now uses a logged-out window for sensitive searches and clears his history on a schedule.', '- Review and auto-delete search history in your account settings.
- Use a privacy-focused search engine for sensitive topics.
- Search while logged out when appropriate.
- Be mindful of search history on shared devices.', '[{"question":"Search queries can reveal:","options":["Nothing","Health, financial, and personal interests","Only weather","Your password"],"answer":1,"explanation":"Queries are very personal data."},{"question":"One way to limit stored search history is:","options":["Searching more","Turning on auto-delete in account settings","Using all caps","Using more tabs"],"answer":1,"explanation":"Many providers offer history controls."},{"question":"Privacy-focused search engines claim to:","options":["Hack trackers","Not build personal search profiles","Replace browsers","Block all ads everywhere"],"answer":1,"explanation":"Read each provider''s policy to understand its claims."}]'),
  (4, 'Metadata and EXIF Data', 'Metadata is data about data. EXIF metadata in photos can include the camera model, date and time, and sometimes GPS coordinates.

Metadata is written automatically when a file is created. You rarely see it, and it can be far more revealing than the visible content of the file.', 'A photo can reveal where you live or where you were, even if the image itself shows nothing identifying.

Documents carry metadata too, such as author names, company names, and edit history. Sharing a file without checking that metadata can reveal who wrote it and how it was produced.', 'Phones may embed location in photos if location access is enabled for the camera. Many large social platforms remove EXIF data on upload, but files sent as documents, by email, or through some apps and websites may keep it. Documents can also contain author names and edit history.

The safest assumption is that a file contains more than you can see. Before sharing a photo or document outside a trusted circle, check its properties or use a tool or share-sheet option to remove location and other hidden data.

Screenshots usually do not carry the same metadata as the original photo, but they can still reveal information visible on screen, such as addresses, names, or notifications.', 'Someone sells an item online and attaches original photos taken at home. The files still contain GPS coordinates that point to their house. The seller only realized after a buyer mentioned the exact location, which had come from the image data.', '- Turn off location tagging for your camera app if you do not need it.
- Remove location before sharing (most phones offer an option in the share sheet).
- Check document properties for author names before sending.
- Assume the original file contains more than you can see.
- Crop or blur backgrounds that reveal your home or workplace.', '[{"question":"EXIF data can include:","options":["GPS location","Your bank PIN","Your browser history","Nothing useful"],"answer":0,"explanation":"Photos can contain location coordinates."},{"question":"Do all sharing methods remove EXIF?","options":["Yes, always","No; some keep the original file''s metadata","Only email removes it","Only USB"],"answer":1,"explanation":"Behavior varies by platform and method."},{"question":"A simple way to reduce photo metadata risk is:","options":["Taking blurrier photos","Disabling camera location tagging","Using bigger files","Renaming files"],"answer":1,"explanation":"If location is never recorded, it cannot leak."}]'),
  (5, 'Location Sharing Risks', 'Location sharing includes live location in maps or messaging apps, check-ins, location-tagged posts, and fitness apps that record routes.

Some sharing is useful, such as meeting a friend or letting family know you arrived safely. The risk comes from sharing that is continuous, public, or forgotten.', 'Real-time or habitual location data can expose your home, routine, and when you are away. Patterns are often more revealing than single points: where you sleep, where you work, and when you are predictably elsewhere.

Location data can also be collected by apps in the background and sold, which makes permissions an important part of your privacy.', 'Apps may share location continuously with contacts or publicly. Fitness apps can reveal start and end points of runs, often your home.

Location permissions are usually offered as "Always," "While using," or "Never." Most apps only need access while you are actively using them. Background access should be reserved for apps that truly need it, such as navigation during a trip.

Periodically checking which apps have location access, and when they used it, helps you notice unexpected sharing.', 'A runner''s public fitness profile shows the same route each morning starting and ending at one address, revealing where they live and when they leave. The runner had not noticed that the profile was visible to everyone, because the default setting had never been changed.', '- Review which apps have "Always" location access and reduce it to "While using" or "Never."
- Share live location only with trusted people and for a limited time.
- Set privacy zones around your home in fitness apps.
- Avoid real-time location tags in public posts.
- Check whether your fitness activities are public by default.', '[{"question":"Fitness app routes can reveal:","options":["Your home and routine","Nothing","Only distance","Your password"],"answer":0,"explanation":"Start and end points often reveal your home."},{"question":"A safer location permission for most apps is:","options":["Always","While using the app","Shared publicly","Shared with everyone"],"answer":1,"explanation":"Limit background access to what is needed."},{"question":"Privacy zones in fitness apps:","options":["Hide the parts of routes near chosen places","Make routes public","Speed up GPS","Delete the app"],"answer":0,"explanation":"They mask sensitive start and end points."}]'),
  (6, 'Social Media Privacy', 'Social media privacy is control over who can see your posts, profile details, friends list, and tagged content.

Privacy on social platforms is shaped by three things: the settings you choose, the settings the platform defaults to, and what other people post about you. All three matter.', 'Profiles are a main source for scammers, stalkers, and identity thieves. Even a few details, like a birthday, a workplace, and a school, can help someone impersonate you or guess security answers.

Social media also reveals relationships. A public friends list or tagged photos can show who your family members are, which makes targeted scams more convincing.', 'Default settings often make content public. Old posts, tagged photos, and friend lists can reveal relationships, schools, workplaces, and routines.

Platforms change their settings and menus frequently, so a privacy review done once can drift out of date. Running the built-in privacy checkup regularly is a practical habit.

Tagging deserves special attention. When someone else tags you, the content may appear on your profile and in front of your contacts unless you approve it. Turning on tag review gives you a chance to decide what is shown.', 'A scammer studies a person''s public family photos and names, then messages their grandparent pretending to be that person in an emergency. The grandparent was convinced because the message used a familiar nickname that had appeared in public posts.', '- Run each platform''s privacy checkup.
- Limit old posts to friends.
- Hide your friends list and contact details.
- Require approval for tags.
- Think about who could see a post before sharing.
- Talk with family about what not to post about children or relatives.', '[{"question":"A public friends list can help scammers:","options":["Do nothing","Identify family and contacts to target or impersonate","Improve your privacy","Block spam"],"answer":1,"explanation":"It maps your relationships."},{"question":"Requiring tag approval:","options":["Lets you review posts that mention you before they appear on your profile","Deletes your account","Makes everything public","Has no effect"],"answer":0,"explanation":"It gives you control over tagged content."},{"question":"A good regular habit is:","options":["Making all posts public","Running the platform''s privacy checkup","Sharing your phone number","Accepting all friend requests"],"answer":1,"explanation":"Settings and defaults change over time."}]'),
  (7, 'Tor, Private Browsing, and Anonymity Misconceptions', '- Private/incognito browsing: does not save history, cookies, or form data on your device after you close the window.
- Tor Browser: routes traffic through three volunteer relays to hide your IP address from sites and your network provider from your destinations.

Both tools protect against specific risks. Neither is a general shield for everything you do online.', 'Many people overestimate what these tools do, which leads to risky behavior. Confidence in a tool can lead to sharing information that identifies you.

Understanding the limits helps you choose the right tool for the right purpose, such as a shared computer for private browsing, or Tor for reducing network-level tracking.', 'Incognito does not hide your activity from websites, your employer or school network, or your ISP. Tor provides strong network anonymity, but logging into personal accounts, sharing identifying details, or downloading and opening files can still reveal who you are. The Tor exit relay can see traffic that is not encrypted with HTTPS.

Incognito is mainly useful for keeping a local record off a shared device. It does not change what the sites, networks, or your employer can see.

Tor users often make mistakes that identify them: logging into a personal account, using a browser with extra add-ons, or sharing details that are unique to them. Behavior often identifies people more than the technology does.', 'Ana uses incognito mode at work, believing her employer cannot see what sites she visits. The company network logs every connection regardless. Ana learned that her browsing was visible to IT when a routine security review flagged an unusual connection.', '- Use incognito to avoid leaving history on a shared device, not for anonymity.
- If you use Tor, do not log into personal accounts and keep using HTTPS.
- Remember that behavior (what you say and log into) often identifies you more than technology does.
- Know your network: work and school networks may log everything you do.', '[{"question":"Incognito mode prevents:","options":["Your ISP from seeing your activity","Local history from being saved after closing","Websites from seeing you","Malware"],"answer":1,"explanation":"It is a local privacy feature only."},{"question":"How many relays does a typical Tor circuit use?","options":["One","Three","Ten","None"],"answer":1,"explanation":"Tor circuits use guard, middle, and exit relays."},{"question":"What can still reveal your identity on Tor?","options":["Logging into personal accounts","Using HTTPS","Closing the browser","Using default settings"],"answer":0,"explanation":"Logging in tells the site exactly who you are."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 6
on conflict (module_id, lesson_order) do nothing;

-- Module 7
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Identifying Your Threat Model', 'A threat model is a structured description of what you are protecting, from whom, and how much effort it is worth.

It turns vague worry ("I want to be safe online") into specific decisions ("my banking email needs a dedicated password and a security key"). You do not need special training to build one; a few honest answers are enough.', 'Security advice is not one-size-fits-all. A journalist, a small business owner, and a student face different threats, and each should make different choices.

A threat model also helps you avoid overspending or overcomplicating. Protections that do not match a real threat can cost time and money without making you safer.', 'Answer five questions: What do I want to protect? Who do I want to protect it from? How likely is it that I will need to protect it? How bad are the consequences if I fail? How much trouble am I willing to go through to prevent them? (These questions are adapted from EFF''s Surveillance Self-Defense guide.)

Write the answers down. A written model is easier to revisit and to share with someone you trust. Be honest about adversaries who are close to you, such as former partners or household members, because they often have the most access.

Revisit the model when your life changes, such as a new job, a move, a breakup, or a new device.', 'Mara''s main concern is an ex-partner who knows her old passwords and devices. Her threat model leads her to change passwords, check for stalkerware, review location sharing, and log out of all sessions, rather than buying expensive tools. Her model made the priorities clear, and it kept her from spending money on defenses against threats she did not face.', '- Write down your top assets and adversaries.
- Match protections to realistic threats.
- Revisit your model when your situation changes.
- Use the Threat Modeling Simulator in Labs to practice.
- Consider whether anyone who knows your passwords or devices should be part of the model.', '[{"question":"A threat model starts with:","options":["Buying tools","What you want to protect","Deleting accounts","Changing ISPs"],"answer":1,"explanation":"You must first know your assets."},{"question":"Why is threat modeling personal?","options":["Everyone faces the same threats","Different people have different assets and adversaries","It is required by law","It is not personal"],"answer":1,"explanation":"Protections should match your actual risks."},{"question":"Which is part of a threat model?","options":["How much trouble you will accept to prevent harm","Your favorite app color","Your phone brand only","Your typing speed"],"answer":0,"explanation":"Effort and cost matter in choosing protections."}]'),
  (2, 'Risk Assessment', 'Risk assessment is ranking risks by likelihood and impact so you can decide what to fix first.

It is a simple, structured version of the judgment you already make. The benefit comes from writing the reasoning down so that you can compare risks side by side.', 'You have limited time and money. Assessment focuses effort on the biggest risks.

Without a ranking, people tend to fix the risks that are most vivid or most recently discussed in the news, rather than the ones most likely to hurt them.', 'List threats and vulnerabilities, rate each for likelihood and impact (for example, 1–3), and multiply. Address high scores first, and accept or monitor low scores.

The scale is a tool for thinking, not a precise measurement. The value is in comparison. A score of 9 should get attention before a score of 3, even though neither number is exact.

Re-assess after major changes, such as a new device, a new financial account, or a change in relationships.', 'Jun rates "email takeover" as likely (3) and severe (3) = 9, and "laptop theft at home" as unlikely (1) but severe (3) = 3. He secures his email with MFA first. He decides to accept the laptop risk for now, because his disk is encrypted and his backups are current.', '- Use a simple likelihood × impact grid.
- Fix the highest scores first.
- Re-assess after big changes.
- Document decisions so you remember why you made them.
- Note which risks you chose to accept and when you will review them.', '[{"question":"Likelihood 3 × Impact 2 gives a score of:","options":["5","6","1","32"],"answer":1,"explanation":"3 × 2 = 6."},{"question":"Which risk should be addressed first?","options":["Score 2","Score 9","Score 4","Score 1"],"answer":1,"explanation":"Highest likelihood × impact first."},{"question":"Low-score risks can be:","options":["Ignored forever without thought","Accepted or monitored consciously","Always fixed first","Made public"],"answer":1,"explanation":"Accepting a small risk is a valid, deliberate choice."}]'),
  (3, 'Compartmentalization', 'Compartmentalization means separating parts of your digital life so a problem in one area does not spread to others.

It is the same principle that ships are built with watertight compartments: one breach should not sink the whole vessel.', 'If everything is linked to one email and one password, a single breach exposes everything.

Compartmentalization also reduces the reach of phishing and impersonation. An attacker who controls a shopping account should not be able to reach your banking or work accounts.', 'Use separate emails, browsers or browser profiles, devices, or accounts for different purposes: banking, work, shopping, social, and sign-ups.

Email is the most important compartment, because it is often the recovery route for everything else. Giving your financial accounts their own email, used for little else, reduces who knows about them and where phishing can reach.

Aliases and disposable addresses can be used for newsletters and one-time sign-ups. They can be retired if they start receiving spam or are exposed in a breach.', 'Lia uses one email for banking, another for shopping and newsletters. When a shopping site is breached, phishing floods that inbox, but her banking email remains unknown to attackers. Her banking account stays protected because the breach did not connect to it.', '- Use a dedicated email for financial accounts.
- Use email aliases or a secondary address for sign-ups.
- Separate work and personal devices or accounts.
- Use different browser profiles for different activities.
- Avoid linking every account to a single phone number where possible.', '[{"question":"Compartmentalization limits:","options":["Internet speed","How far a single breach can spread","Battery life","Screen time"],"answer":1,"explanation":"Separation contains damage."},{"question":"A dedicated email for banking helps because:","options":["It is free","Fewer people know it, so it receives fewer targeted attacks","It removes MFA","It is faster"],"answer":1,"explanation":"Less exposure means less targeting."},{"question":"Which is a form of compartmentalization?","options":["Using one password everywhere","Separate browser profiles for work and personal use","Sharing accounts","Posting everything publicly"],"answer":1,"explanation":"Profiles keep cookies and logins separate."}]'),
  (4, 'The Need-to-Know Principle', 'Need-to-know means sharing information only with people who actually need it to do their part.

It is common in military and government settings, but it is just as useful for families, small teams, and personal accounts.', 'Every extra person who knows something is another possible leak, by accident or on purpose. People change jobs, lose devices, and share screens without thinking, so the more people who have access, the more likely something will go wrong.

It also protects relationships. Limiting access to sensitive information reduces the chance of misunderstandings or resentment when plans change.', 'Before sharing, ask: Does this person need this specific information? Do they need all of it? For how long? This applies to family plans, work data, and passwords.

A practical approach is to share access through tools designed for it, such as a password manager''s sharing feature, rather than by copying the information into a message. Tools of that kind let you see who has access and remove it later.

Revisit access periodically. Former employees, past partners, and old shared subscriptions often keep access long after they should.', 'An office shares the admin password for its main account in a group chat with 40 people. When one member''s phone is stolen, the password is exposed. The office had to change the password, check every system it protected, and remove access for everyone who had been in the chat.', '- Share the minimum information needed.
- Use password managers'' sharing features instead of chat messages.
- Remove access when people no longer need it.
- Avoid discussing sensitive plans in public places.
- Keep a simple list of who has access to shared accounts.', '[{"question":"Need-to-know means:","options":["Tell everyone for transparency","Share only with those who need it, and only what they need","Never share anything","Share publicly"],"answer":1,"explanation":"Minimize who knows and how much."},{"question":"A safer way to share a password with a coworker is:","options":["Group chat","A password manager''s secure sharing feature","Email subject line","Sticky note"],"answer":1,"explanation":"Secure sharing can be controlled and revoked."},{"question":"When someone no longer needs access, you should:","options":["Leave it","Remove their access","Give more access","Post the password"],"answer":1,"explanation":"Regularly review and revoke access."}]'),
  (5, 'Information Classification', 'Information classification means labeling information by how sensitive it is, so you know how to handle it.

Classification is not about bureaucracy. It is a shortcut that helps you decide, quickly and consistently, where something can be stored and who can see it.', 'Treating everything the same leads to either overprotecting trivial data or underprotecting critical data. A simple scheme makes everyday decisions faster and more reliable.

Classification also helps you when you are in a hurry. A message asking for a recovery code should trigger the same rules every time, even if the request looks harmless.', 'A simple personal scheme: Public (fine to share), Internal (family/friends only), Confidential (ID numbers, finances, health), and Restricted (passwords, recovery codes, private keys). Each level has handling rules.

For each level, decide where the information may be stored, how it may be sent, and how long you keep it. For example, Restricted items should live only in a password manager or encrypted storage and should never be sent through chat.

Review old files periodically. Documents you no longer need are often the most dangerous, because they are forgotten and unprotected.', 'Ella classifies her scanned passport as Confidential: stored encrypted, never sent over chat, and shared only with verified organizations when required. When a relative asked for a copy, Ella sent it through an official, verified channel and deleted the temporary download afterward.', '- Define three or four levels for your own information.
- Decide where each level may be stored and how it may be shared.
- Encrypt Confidential and Restricted data.
- Shred or securely delete sensitive data you no longer need.
- Write handling rules down so you can apply them consistently.', '[{"question":"Recovery codes would most likely be classified as:","options":["Public","Internal","Restricted","Unimportant"],"answer":2,"explanation":"They grant direct access to accounts."},{"question":"Why classify information?","options":["To apply the right protection to the right data","To make files bigger","For fun only","To share more"],"answer":0,"explanation":"Protection should match sensitivity."},{"question":"Confidential data should usually be:","options":["Posted online","Stored encrypted and shared only when necessary","Sent in group chats","Printed and left out"],"answer":1,"explanation":"Sensitive data needs stronger handling rules."}]'),
  (6, 'Secure Communication', 'Secure communication protects the content of your messages and calls from being read by others, and helps confirm who you are talking to.

Two separate questions matter here. The first is whether someone can read the message in transit. The second is whether the person you are talking to is really who they claim to be.', 'Messages can contain sensitive details. Interception, compromised accounts, or the wrong recipient can expose them.

A wrong recipient is an underrated risk. Sending a sensitive document to the wrong contact, or to a copied address, can cause as much harm as any hack.', 'End-to-end encryption (E2EE) means only the sender and recipients can read messages; the service provider cannot. Signal uses E2EE by default; WhatsApp also uses E2EE for chats. Regular SMS is not end-to-end encrypted. Even with E2EE, metadata (who you talk to and when) may still be visible to the provider, and anyone who can open your unlocked phone can read your messages.

Safety numbers or security codes let you confirm that a conversation is with the person you expect. If the code changes unexpectedly, that can indicate a new device or, in rare cases, interception, so it is worth checking.

Disappearing messages can reduce how long content sits on devices, but they do not stop a recipient from copying what they see.', 'Two colleagues verify each other''s Signal safety numbers in person before discussing a confidential project, confirming no one is impersonating either of them. The check takes a minute and gives them confidence that the conversation is private and genuine.', '- Prefer E2EE messengers for sensitive conversations.
- Verify safety numbers or security codes for important contacts.
- Use disappearing messages where appropriate.
- Protect devices with strong locks; E2EE does not protect an unlocked phone.
- Double-check recipients before sending sensitive files.', '[{"question":"End-to-end encryption means:","options":["The provider can read messages","Only the sender and recipients can read messages","Messages are public","No internet is needed"],"answer":1,"explanation":"Keys exist only on participants'' devices."},{"question":"Regular SMS is:","options":["End-to-end encrypted","Not end-to-end encrypted","Anonymous","Untraceable"],"answer":1,"explanation":"SMS can be accessed by carriers and sometimes intercepted."},{"question":"Even with E2EE, what may still be visible to the provider?","options":["Message content","Metadata such as who you talk to and when","Your password","Nothing"],"answer":1,"explanation":"Metadata can still be revealing."}]'),
  (7, 'OpSec Failures and Real-World Case Studies', 'Studying real incidents shows how small mistakes lead to large consequences.

Case studies work because they connect each principle to a real sequence of events. They also show that even well-resourced organizations make ordinary mistakes.', 'Case studies make abstract advice concrete and memorable. They also help you practice the habit of asking what went wrong, which is the same habit that protects you.

Each case teaches a transferable lesson. You do not need to know every technical detail to learn from the pattern.', 'Common themes: oversharing (public fitness or photo data), weak or reused credentials without MFA, social engineering of support staff, and third-party access. The Reference Hub includes case summaries such as the 2018 fitness heatmap revelations, the 2020 Twitter phone-spear-phishing incident, and the 2021 Colonial Pipeline ransomware attack.

When reading a case, separate what was technical from what was human. Many incidents turned on a single ordinary decision, such as a default setting or a message that was trusted too quickly.

Finish each case by identifying one thing you would do differently in your own life.', 'In January 2018, researchers noticed that a fitness app''s public global heatmap revealed activity patterns around sensitive military locations, because personnel recorded their runs with default sharing settings. The data was not hacked; it was shared exactly as the app was designed to share it.', '- For each case, ask: What was the critical information? Which vulnerability was used? What simple countermeasure would have helped?
- Apply the same questions to your own habits.
- Write down one change you will make after each case you study.', '[{"question":"The 2018 fitness heatmap issue was mainly caused by:","options":["A data breach","Users sharing activity data with default/public settings","Ransomware","A router flaw"],"answer":1,"explanation":"The data was shared publicly through normal app features."},{"question":"A common lesson across many incidents is:","options":["Small, ordinary mistakes can have big effects","Only experts make mistakes","Security tools always prevent breaches","Nothing can be learned"],"answer":0,"explanation":"Basic failures often enable major incidents."},{"question":"When studying a case, a useful question is:","options":["Who is to blame?","What simple countermeasure would have helped?","How famous was it?","How expensive was it?"],"answer":1,"explanation":"Focus on lessons you can apply."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 7
on conflict (module_id, lesson_order) do nothing;

-- Module 8
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Recognizing Compromised Accounts', 'A compromised account is one that someone else has accessed or controls without your permission.

Compromise is often quiet. The attacker may read messages, change settings, or send messages in your name for days before anyone notices.', 'Spotting compromise early limits damage to you and to contacts who might be scammed in your name. Early action can also stop an attacker from locking you out or changing recovery options.

Many compromised accounts are discovered because a friend or family member noticed something strange, which is why it is worth telling your contacts what to look for.', 'Warning signs: login alerts you did not trigger, password reset emails you did not request, sent messages or posts you did not make, changed recovery details, unfamiliar devices or sessions, and contacts reporting strange messages from you.

Check your active sessions and connected devices regularly. Most major services list them in account security settings, and signing out of sessions you do not recognize is a fast way to cut off an attacker.

If you see signs of compromise, act in a set order: secure the email account first, since it can reset other accounts, then change passwords, sign out of all sessions, and review recovery options.', 'Friends tell Carlo that "he" asked them for money on a chat app. He checks his active sessions and finds an unknown device logged in from another country. Carlo signs out of all sessions, changes his password, turns on MFA, and sends a warning to his contacts so they stop responding to the fake messages.', '- Review active sessions and devices regularly.
- Turn on login alerts.
- Act immediately on warning signs: change the password, sign out of all sessions, enable MFA, and check recovery options.
- Tell close contacts how to verify a strange request from you.', '[{"question":"Which is a sign of account compromise?","options":["A login alert you did not trigger","A normal newsletter","Your own post","A software update"],"answer":0,"explanation":"Unexpected login alerts should be investigated."},{"question":"Where can you often see unknown devices?","options":["Active sessions or device list in account settings","Your phone wallpaper","Calculator","Camera roll"],"answer":0,"explanation":"Most major services list active sessions."},{"question":"First steps after suspected compromise include:","options":["Waiting a week","Changing the password and signing out all sessions","Deleting your phone","Posting about it publicly first"],"answer":1,"explanation":"Cut off the attacker''s access quickly."}]'),
  (2, 'Steps After a Data Breach', 'A data breach is when an organization''s data, possibly including yours, is accessed or leaked without authorization.

Being notified of a breach does not mean you have been hacked. It means your information may be exposed, and you should decide how much to act based on what was leaked.', 'Leaked details can be used for credential stuffing, phishing, and identity fraud. A breach at one company can become a problem for your accounts elsewhere.

Breach notices often arrive late or are vague. Knowing the usual steps lets you respond calmly instead of waiting for complete information.', 'Find out what data was exposed (email, password, phone, ID numbers, payment details). The right response depends on what leaked.

If a password leaked, change it on that site and anywhere else you used it. If payment details leaked, contact your bank or card issuer. If ID numbers leaked, watch for identity misuse and consider the protections available in your country.

After the immediate steps, keep watching. Phishing that refers to the breach is common, because attackers know people are paying attention. Be cautious of messages that offer "help" or ask you to log in to "verify" your account.', 'An online shop announces a breach of emails and hashed passwords. Mika changes that password, and any other account where she reused it, and watches for phishing emails mentioning the shop. A week later she receives an email that looks like a breach notice and asks her to log in. She goes to the shop''s site directly instead of clicking the link.', '- Read the official breach notice to learn what leaked.
- Change the affected password and any reused copies.
- Enable MFA.
- Watch for targeted phishing referencing the breach.
- If payment or ID data leaked, contact your bank and monitor statements.', '[{"question":"After a breach, which passwords should you change?","options":["None","The breached site''s password and anywhere you reused it","Only your Wi-Fi password","Your phone PIN only"],"answer":1,"explanation":"Reused passwords are at risk everywhere."},{"question":"Why expect more phishing after a breach?","options":["Attackers can use leaked details to make messages convincing","Breaches stop phishing","Email providers send more ads","They do not"],"answer":0,"explanation":"Leaked data fuels targeted scams."},{"question":"The response depends mostly on:","options":["What data was exposed","The weather","Your phone brand","The time of day"],"answer":0,"explanation":"Different data requires different actions."}]'),
  (3, 'Securing a Compromised Device', 'A compromised device has malware, stalkerware, or unauthorized access.

Compromise can range from a single unwanted app to a device that is fully monitored. The right response depends on how deep the problem goes and on your personal safety.', 'A compromised device can capture new passwords as you type them, so you must clean it or use another device for recovery. Changing passwords on a compromised device can hand the attacker your new credentials.

In some situations, removing spyware can alert the person who installed it. Safety should come first in those cases.', 'Signs include unknown apps, unusual battery drain or data use, disabled security settings, or pop-ups. Remediation ranges from removing apps and running security scans to a full factory reset.

A practical sequence is to use a known-clean device to secure your most important accounts, then examine the compromised device. Look for unfamiliar apps, device administrator permissions, and unknown profiles or certificates.

If the device seems heavily monitored, or if you are concerned about someone close to you, a factory reset after backing up personal files is often the most reliable option. Restore from backups carefully, and avoid restoring apps or settings that you cannot account for.', 'Dani suspects stalkerware after her ex knew details from her private messages. She contacts a support organization for advice, then changes passwords from a different trusted device before deciding how to deal with the phone. She plans her next steps with the support advocate so that her safety is considered before anything is removed.', '- Use a known-clean device to change important passwords.
- Update the OS, remove unknown apps, and run security scans.
- If in doubt, back up personal files (not apps) and factory reset.
- If you suspect stalkerware, consider your safety first; removing it may alert the person who installed it. Seek help from specialized support organizations.
- Check for unfamiliar device administrator permissions or profiles.', '[{"question":"Why change passwords from a different device?","options":["It is faster","The compromised device may capture new passwords","It is required by law","It saves battery"],"answer":1,"explanation":"Keyloggers or spyware could record new credentials."},{"question":"A strong remediation for a badly infected device is:","options":["Ignoring it","Factory reset after backing up personal files","Changing the wallpaper","Turning off Wi-Fi only"],"answer":1,"explanation":"A reset removes most software-based compromise."},{"question":"Before removing suspected stalkerware, you should:","options":["Consider personal safety, since removal may alert the abuser","Post about it","Ignore it","Share your password"],"answer":0,"explanation":"Safety planning matters in abuse situations."}]'),
  (4, 'Account Recovery Procedures', 'Account recovery procedures are the official steps a service provides to regain control of an account you have lost.

Every major service has a recovery route, though its exact steps differ. Knowing where it is in advance is far better than searching for it in a panic.', 'Knowing the official route in advance saves time and helps you avoid fake "recovery" services. Recovery attempts made under stress are where many people make mistakes.

Recovery can also be slow. Some providers take days to verify identity, so starting early matters.', 'Most providers offer recovery forms, identity verification, backup codes, or trusted contacts. Recovery may take days. Use only official help pages, which you should reach by typing the address yourself or through the official app.

Have your information ready: the email address or phone number you used, approximate dates of account creation, and any devices you previously logged in from. Providers use these details to confirm ownership.

After recovery, treat the account as if it was compromised. Change the password, check connected devices, review recovery options, and look for changes the attacker might have made, such as forwarding rules or new contact details.', 'After losing access to his social media account, Ken searches online and finds a "recovery expert" asking for payment. He instead uses the platform''s official recovery form and backup codes. He then reviews his connected apps and removes one he did not recognize.', '- Save backup codes and keep recovery info current before you need it.
- Use only official help pages and in-app options.
- Never pay strangers to recover accounts.
- After recovery: change the password, review sessions, enable MFA, and check for changes the attacker made.', '[{"question":"A stranger offers to recover your account for a fee. This is likely:","options":["Official support","A scam","Required","Free help"],"answer":1,"explanation":"Recovery scams target people in distress."},{"question":"What should you do after regaining access?","options":["Nothing","Change the password, review sessions, enable MFA, and check settings","Delete your email","Share the password"],"answer":1,"explanation":"Remove the attacker''s foothold and changes."},{"question":"When is the best time to set up recovery options?","options":["After losing access","Before you need them","Never","Only on holidays"],"answer":1,"explanation":"Preparation makes recovery possible."}]'),
  (5, 'Backups and Disaster Recovery', 'A backup is a separate copy of your data that you can restore after loss, theft, hardware failure, or ransomware.

Disaster recovery is the broader plan for getting back to normal, including knowing which data matters most, where copies live, and how to restore them.', 'Without backups, a single incident can permanently erase photos, documents, and work. Ransomware in particular makes backups the most reliable path to recovery without paying criminals.

Backups also protect against ordinary accidents, such as a dropped laptop, a deleted folder, or a failed drive.', 'The 3-2-1 rule: keep 3 copies of your data, on 2 different types of storage, with 1 copy off-site (for example, in the cloud or another location). Keep at least one backup disconnected or versioned so ransomware cannot encrypt it too. Test restoring occasionally.

Versioned backups keep multiple earlier copies of each file, which lets you go back to a version from before an attack or an accidental change. Ordinary sync services copy changes as they happen, including ransomware damage, so check whether version history is available.

Backups should also include the things people forget: phone photos, messages, recovery codes stored securely, and the documents needed to reinstall your key software.', 'Ransomware encrypts Rico''s laptop and the external drive that was plugged in. His cloud backup with version history lets him restore files from before the attack. Because he tested restores every few months, he knew the process and recovered his work within a day.', '- Follow the 3-2-1 rule.
- Use cloud backup with version history and an external drive you disconnect after backing up.
- Test restoring a file periodically.
- Back up phone photos and two-factor recovery codes too (store recovery codes in a secure location, not in an ordinary file).', '[{"question":"In the 3-2-1 rule, the \"1\" means:","options":["One password","One copy off-site","One device","One day"],"answer":1,"explanation":"An off-site copy survives local disasters."},{"question":"Why keep a backup disconnected?","options":["To save power","So ransomware cannot encrypt it too","It is faster","No reason"],"answer":1,"explanation":"Connected drives can be encrypted along with the computer."},{"question":"Why test restoring?","options":["To confirm backups actually work","To waste time","It deletes old files","It is not useful"],"answer":0,"explanation":"Untested backups may fail when needed."}]'),
  (6, 'Reporting Cybercrime', 'Reporting cybercrime means notifying the right organizations: your bank or e-wallet, the platform involved, and law enforcement or a national cybercrime authority.

Reports serve two purposes. They can help you recover what you lost, and they help investigators and platforms identify patterns and take down scam operations.', 'Fast reporting can sometimes freeze stolen funds, take down scam accounts, and help protect others. Many victims feel embarrassed and wait too long, which reduces the chance of recovery.

Even if you cannot recover money, reporting helps prevent the same scheme from reaching other people.', 'Contact your bank or e-wallet first if money is involved, since transfers may sometimes be stopped if reported quickly. Report the account or message to the platform. Then file a report with the relevant authority. In the Philippines, the Cybercrime Investigation and Coordinating Center (CICC) runs the 24/7 Inter-Agency Response Center hotline 1326; the PNP Anti-Cybercrime Group and NBI Cybercrime Division also receive complaints. In the United States, reports go to the FBI''s Internet Crime Complaint Center (ic3.gov). Check your own country''s official channels.

When you report, be factual and organized. Write down a timeline, the amounts, the payment method, and the contact details used by the scammer. Official channels may ask for these details, so having them ready helps.

Be alert to follow-up scams. Fake recovery agents often contact victims after a report, promising to get money back for a fee.', 'Within minutes of realizing she was scammed, Liza calls her e-wallet provider to report the transfer, reports the scammer''s profile to the platform, and files a report with the national cybercrime hotline, keeping screenshots as evidence. Two days later, someone calling about "recovery" asks for a fee, and Liza recognizes the pattern and hangs up.', '- Act quickly when money is involved.
- Keep evidence: screenshots, transaction IDs, usernames, phone numbers, links, and dates.
- Report to your bank or e-wallet, the platform, and the official cybercrime authority.
- Beware of fake "recovery" agents who contact you after you report.
- Keep a written timeline of what happened.', '[{"question":"If money was stolen, who should you usually contact first?","options":["Your bank or e-wallet provider","A recovery agent you found online","No one","The scammer"],"answer":0,"explanation":"Quick reporting may allow a transfer to be stopped."},{"question":"Which evidence should you keep?","options":["Screenshots, transaction IDs, usernames, links, and dates","Nothing","Only your feelings","Only the final balance"],"answer":0,"explanation":"Details help investigators and providers."},{"question":"In the Philippines, the CICC''s 24/7 cybercrime hotline number is:","options":["911","1326","8888","117"],"answer":1,"explanation":"The Inter-Agency Response Center hotline is 1326."}]'),
  (7, 'Building Your Personal OpSec Checklist', 'A personal OpSec checklist is a short list of security habits and settings tailored to your own threat model.

It is the practical result of everything in this course. Instead of holding many ideas in your head, you keep a single list you can review and act on.', 'A checklist turns knowledge into action and helps you keep habits over time. Without one, good intentions tend to fade after the course ends.

A checklist also makes it easier to share your approach with family members or colleagues, and to help others get started.', 'Combine what you learned: protect critical accounts, secure devices, manage your footprint, prepare for incidents. Review it every few months and after big life changes.

Keep the list short enough that you will actually use it. Ten to fifteen items that matter to your situation are better than a long list you never revisit.

Group items by area: accounts, devices, privacy, backups, and response. Mark each item as done, in progress, or not applicable to your life, so your review is quick.', 'Ivy builds her checklist: password manager set up, MFA on email and banking, phone encrypted with a strong PIN, backups weekly, privacy settings reviewed, recovery codes stored. She sets a calendar reminder to review it quarterly and adds an item to check her router firmware once a year.', '- Use the Security Checklist on your Dashboard; it syncs to your account.
- Start with high-impact items: email MFA, unique passwords, updates, backups.
- Add items specific to your threat model.
- Review every 3–6 months.
- Share the checklist with a trusted person who can help you keep it current.', '[{"question":"A personal checklist should be:","options":["Identical for everyone","Tailored to your threat model","Kept secret from yourself","Done once and forgotten"],"answer":1,"explanation":"Your risks shape your checklist."},{"question":"Which is a high-impact first item?","options":["Changing wallpaper","Enabling MFA on your email","Buying a new phone","Deleting all apps"],"answer":1,"explanation":"Email protects most other accounts."},{"question":"How often should you review your checklist?","options":["Never","Every few months and after major changes","Every hour","Only after being hacked"],"answer":1,"explanation":"Regular reviews keep it current."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 8
on conflict (module_id, lesson_order) do nothing;

insert into public.daily_tips (tip_text, category) values
  ('Turn on multi-factor authentication for your primary email first. It is the key that resets most of your other accounts.', 'Accounts'),
  ('Never share one-time codes (OTPs) with anyone who contacts you, even if they claim to be your bank.', 'Social Engineering'),
  ('Long-press a link on your phone to preview where it really goes before tapping.', 'Phishing'),
  ('Use a password manager so every account gets its own unique password.', 'Accounts'),
  ('Post vacation photos after you return home, not while you are away.', 'Privacy'),
  ('Restart your phone and computer when updates are waiting. Patches only protect you once installed.', 'Devices'),
  ('Lock your screen every time you step away: Windows+L on Windows, Ctrl+Cmd+Q on a Mac.', 'Physical'),
  ('Confirm the official Wi-Fi name with staff before connecting in cafés, hotels, or airports.', 'Network'),
  ('Review which apps can access your location "Always" and switch them to "While using" or "Never."', 'Privacy'),
  ('Keep at least one backup disconnected from your computer so ransomware cannot reach it.', 'Recovery'),
  ('A padlock icon means the connection is encrypted, not that the website is trustworthy.', 'Network'),
  ('If a message makes you feel rushed or scared, pause. Urgency is a manipulation tactic.', 'Social Engineering'),
  ('Use random answers for security questions and store them in your password manager.', 'Accounts'),
  ('Change your router''s default admin password and update its firmware.', 'Network'),
  ('Never plug in a USB drive you found. Hand it to IT or security instead.', 'Devices')
on conflict (tip_text) do nothing;

insert into public.case_studies (sort_order, title, summary, failure, lesson, links_json) values
  (1, 'Fitness heatmap reveals sensitive sites (2018)', 'In January 2018, analysts pointed out that Strava''s public global heatmap, built from users'' recorded workouts, showed activity patterns around military bases in remote areas, revealing their layouts and patrol routes.', 'Individually harmless workout data, shared under default settings, became sensitive when aggregated.', 'Check privacy defaults on fitness and location apps; aggregated data can reveal what individual data points do not.', '[{"label":"The Guardian: Strava gives away location of secret US army bases","url":"https://www.theguardian.com/world/2018/jan/28/fitness-tracking-app-gives-away-location-of-secret-us-army-bases"},{"label":"BBC News: Fitness app Strava lights up staff at military bases","url":"https://www.bbc.com/news/technology-42853072"}]'::jsonb),
  (2, 'Twitter phone spear-phishing (2020)', 'On July 15, 2020, attackers phoned Twitter employees and talked some of them into giving up credentials, then used internal tools to take over high-profile accounts and post a cryptocurrency scam.', 'Social engineering of staff with access to powerful internal tools.', 'Verify callers independently, use phishing-resistant MFA, and limit who can access powerful tools.', '[{"label":"Krebs on Security: Who''s behind Wednesday''s epic Twitter hack?","url":"https://krebsonsecurity.com/2020/07/whos-behind-wednesdays-epic-twitter-hack/"}]'::jsonb),
  (3, 'Colonial Pipeline ransomware (2021)', 'In May 2021, a ransomware attack led Colonial Pipeline to shut down its U.S. fuel pipeline for several days. The company''s CEO later told the U.S. Senate that attackers got in through a legacy VPN account protected only by a password, without MFA.', 'An old, unused account with a single factor remained active.', 'Turn on MFA everywhere and remove accounts you no longer use.', '[{"label":"CISA: The attack on Colonial Pipeline, what we''ve learned","url":"https://www.cisa.gov/news-events/news/attack-colonial-pipeline-what-weve-learned-what-weve-done-over-past-two-years"},{"label":"CISA advisory AA21-131A: DarkSide ransomware","url":"https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-131a"}]'::jsonb),
  (4, 'Photo metadata reveals a location (2012)', 'In December 2012, a photo published online of John McAfee, who was avoiding authorities, still contained EXIF GPS metadata that indicated he was in Guatemala.', 'The original image file was shared with location metadata intact.', 'Strip location data from photos before sharing, and assume original files contain more than you can see.', '[{"label":"WIRED: Did Vice just give away John McAfee''s location with photo metadata?","url":"https://www.wired.com/2012/12/oops-did-vice-just-give-away-john-mcafees-location-with-this-photo/"}]'::jsonb),
  (5, 'Support desks social-engineered (2012)', 'Technology journalist Mat Honan described how attackers combined information obtained from Amazon and Apple customer support to take over his Apple ID, remotely erase his iPhone, iPad, and MacBook, and hijack his Twitter account. Many personal photos were lost because he had no backup.', 'Linked accounts with weak recovery processes, and no backups.', 'Secure recovery options, use MFA, compartmentalize important accounts, and keep backups.', '[{"label":"WIRED: How Apple and Amazon security flaws led to my epic hacking","url":"https://www.wired.com/2012/08/apple-amazon-mat-honan-hacking/"},{"label":"WIRED: How I resurrected my digital life after an epic hacking","url":"https://www.wired.com/2012/08/mat-honan-data-recovery/"}]'::jsonb),
  (6, 'Third-party vendor access (Target, 2013)', 'Attackers used network credentials stolen from a heating and air-conditioning vendor to get into Target''s network, then stole payment card data from about 40 million cards during the 2013 holiday season.', 'Third-party access was not well separated from sensitive systems.', 'Limit access on a need-to-know basis and separate (compartmentalize) systems.', '[{"label":"Krebs on Security: Target hackers broke in via HVAC company","url":"https://krebsonsecurity.com/2014/02/target-hackers-broke-in-via-hvac-company/"}]'::jsonb)
on conflict (title) do nothing;

-- ---------------------------------------------------------------------
-- 9. MAKE YOURSELF AN ADMIN (run separately after you sign up in the app)
-- update public.profiles set role = 'admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------
