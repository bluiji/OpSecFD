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

-- Module 1
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'What is OpSec?', 'Operational Security (OpSec) is the habit of looking at your own life the way an attacker would, so you can spot which small pieces of information or behavior could be used against you, and then protect them.

The term comes from the military, but the idea applies to everyone: your passwords, your home address, your daily routine, and even a photo of your boarding pass are all pieces of information someone could misuse.', 'Most people are not hacked by genius-level attacks. They are harmed because ordinary details were easy to find and easy to combine: a birthday on social media, a reused password, a pet''s name that doubles as a security answer.

OpSec helps you decide what is worth protecting before something goes wrong, instead of reacting afterward.', 'OpSec is a way of thinking, not a product. It works by asking a few simple questions over and over:

- What do I have that someone might want (money, accounts, identity, location, reputation)?
- Who might want it, and how could they get it?
- Which of my habits make that easier?
- What is the simplest change that makes it harder?

Technical tools (password managers, encryption, updates) are part of the answer, but so are physical habits (locking your screen), human behavior (not oversharing), and situational awareness (noticing who is looking over your shoulder).', 'Ana posts a photo celebrating her new job. The photo shows her company ID badge, her face, and the office lobby. A scammer now knows her full name, employer, and what the badge looks like. A week later, a coworker receives an email "from Ana" asking for an urgent gift-card purchase for a client.

Nothing was hacked. The attacker simply collected information Ana shared without thinking about who else could see it.', '- Before you share something, ask: "Who else can see this, and what could they do with it?"
- Treat small details (badges, tickets, addresses, routines) as pieces of a larger puzzle.
- Start with the basics covered in this course: strong unique passwords, multi-factor authentication, updates, and healthy skepticism.
- Remember the motto: you do not need to know everything, only what to protect, what can go wrong, and how to reduce the risk.', '[{"question":"Which statement best describes OpSec?","options":["A type of antivirus software","A way of thinking about what to protect and how it could be exposed","A government-only security clearance","A method for hacking into accounts"],"answer":1,"explanation":"OpSec is a mindset and process for identifying and protecting critical information. Tools help, but OpSec itself is not a product."},{"question":"Which of these is an example of an OpSec mistake?","options":["Using a password manager","Locking your phone with a PIN","Posting a photo that clearly shows your work ID badge","Installing system updates"],"answer":2,"explanation":"A visible ID badge reveals your name, employer, and badge design, which can be used for impersonation or social engineering."},{"question":"OpSec covers which areas?","options":["Only computers and networks","Only physical locks and doors","Technical, physical, behavioral, and informational habits","Only what you post on social media"],"answer":2,"explanation":"OpSec includes technical security, physical security, human behavior, information handling, and situational awareness."}]'),
  (2, 'Why OpSec Matters', 'This lesson explains why ordinary people, not just companies or governments, are targets, and why small precautions have a large effect.', 'Criminals often work at scale. They send millions of phishing messages, test leaked passwords against many websites automatically, and buy and sell personal data. You do not have to be famous or rich to be a target; you just have to be reachable.

The consequences are real: drained bank or e-wallet accounts, stolen social media accounts used to scam your friends, identity theft, harassment, or loss of irreplaceable photos and files.', 'Most attacks against individuals follow the path of least resistance. Attackers look for:

- Reused passwords that already appeared in a data breach
- Accounts without multi-factor authentication
- People who can be rushed or frightened into acting quickly
- Devices that are missing security updates
- Personal details that are public and can answer security questions

Because attackers go for easy targets, each basic protection you add pushes you out of the "easy" group. You do not have to be perfectly secure, just harder to exploit than the average target.', 'Marco reused the same password for an old online forum and his email. The forum suffered a data breach, and the leaked email-and-password list was shared online. An automated tool tried that combination on popular email services and got in.

From his email, the attacker reset his passwords for social media and an online shopping account. Marco was never personally "chosen"; his reused password made him an easy match.', '- Use a unique password for every important account (a password manager makes this practical).
- Turn on multi-factor authentication for email, banking, and social media first.
- Install updates on your phone and computer promptly.
- Slow down when a message pushes urgency or fear.
- Back up the files you could not bear to lose.', '[{"question":"Why are ordinary people targeted by cybercriminals?","options":["Only because they are famous","Because many attacks are automated and aimed at anyone who is reachable","They are not; only companies are targeted","Because ordinary people always have weak computers"],"answer":1,"explanation":"Many attacks run at scale (mass phishing, automated password testing), so anyone with an account can be hit."},{"question":"Marco''s email was taken over mainly because:","options":["His email provider was hacked directly","He reused a password that leaked in a different site''s breach","He used a long passphrase","He had multi-factor authentication enabled"],"answer":1,"explanation":"Reused passwords leaked from one site can be tried on others. This is called credential stuffing."},{"question":"What does \"pushing yourself out of the easy group\" mean?","options":["Becoming impossible to hack","Adding basic protections so automated or low-effort attacks fail against you","Deleting all your online accounts","Hiring a security company"],"answer":1,"explanation":"No one is perfectly secure, but basic protections stop the most common, low-effort attacks."},{"question":"Which account should you usually secure first?","options":["An old game account","Your primary email account","A newsletter subscription","A weather app"],"answer":1,"explanation":"Your email is often used to reset every other password, so whoever controls it can take over many other accounts."}]'),
  (3, 'The Five Steps of OpSec', 'The classic OpSec process has five steps: (1) identify critical information, (2) analyze threats, (3) analyze vulnerabilities, (4) assess risk, and (5) apply countermeasures. It is a repeatable checklist for deciding what to protect and how.', 'Without a process, security turns into random worrying or buying tools you do not need. The five steps help you focus effort where it matters most and give you a way to re-check your situation when your life changes (a new job, a move, a new device).', '- Step 1 — Identify critical information: What would hurt if it leaked or was lost? Examples: email login, bank details, home address, ID documents, private photos.
- Step 2 — Analyze threats: Who might want it? Scammers, identity thieves, a stalker, a nosy acquaintance, automated bots.
- Step 3 — Analyze vulnerabilities: How could they get it? Reused passwords, public social media posts, an unlocked phone, no backups.
- Step 4 — Assess risk: For each threat and vulnerability, how likely is it and how bad would it be? Focus on the combinations that are both likely and harmful.
- Step 5 — Apply countermeasures: Choose practical fixes, such as MFA, privacy settings, a screen lock, or backups, then revisit the steps periodically.', 'Lea is starting an online business and runs the five steps:

- Critical information: her business email, payment account, and customer list.
- Threats: phishing scammers and people trying to take over her business page.
- Vulnerabilities: she uses SMS codes only, and her personal phone number is public on the page.
- Risk: account takeover is likely and would stop her sales.
- Countermeasures: she switches to an authenticator app, uses a separate business contact number, and enables login alerts.', '- Write down your top five pieces of critical information today.
- For each, list one realistic threat and one weakness.
- Fix the highest-risk item first; do not try to fix everything at once.
- Repeat the process when something big changes in your life.', '[{"question":"What is the first step of the OpSec process?","options":["Apply countermeasures","Assess risk","Identify critical information","Buy security software"],"answer":2,"explanation":"You cannot protect something until you know what it is, so the process starts with identifying critical information."},{"question":"\"My social media is public and shows my school and hometown\" describes a:","options":["Threat","Vulnerability","Countermeasure","Critical asset"],"answer":1,"explanation":"A vulnerability is a weakness that a threat could exploit. Public personal details are a weakness."},{"question":"In risk assessment, which items should you usually fix first?","options":["Ones that are unlikely and low impact","Ones that are both likely and harmful","Whichever is easiest to talk about","Only the newest threats in the news"],"answer":1,"explanation":"Risk combines likelihood and impact. Prioritize what is both likely to happen and damaging if it does."},{"question":"Why should you repeat the five steps over time?","options":["Because the law requires it every month","Because your life, devices, and threats change","Because the steps change every year","You never need to repeat them"],"answer":1,"explanation":"New jobs, devices, relationships, and threats change what you need to protect and how."}]'),
  (4, 'Threats, Vulnerabilities, and Risks', 'These three words are often mixed up:

- A threat is someone or something that could cause harm (a scammer, malware, a thief, a flood).
- A vulnerability is a weakness that the threat could use (a reused password, an unlocked door, an outdated app).
- Risk is the chance that a threat will exploit a vulnerability, combined with how bad the result would be.', 'Knowing the difference keeps you from wasting effort. You usually cannot remove threats (scammers will always exist), but you can almost always reduce vulnerabilities, and that lowers your risk.', 'A simple way to think about it: Risk ≈ Likelihood × Impact.

Example: a thief (threat) could steal your phone. If your phone has no screen lock (vulnerability), the impact is high because they can open your banking and email apps. Adding a strong PIN and remote-wipe does not stop thieves from existing, but it greatly reduces the impact, and therefore the risk.

You can respond to a risk in four ways: reduce it (add protections), avoid it (stop the risky activity), transfer it (for example, insurance or a bank''s fraud protection), or accept it (if it is unlikely and minor).', 'Jo connects to free airport Wi-Fi to check email. The threat is someone on the same network trying to intercept traffic or running a fake hotspot. The vulnerability would be logging into a site that is not using HTTPS, or entering a password on a fake captive-portal page.

Because Jo''s email uses HTTPS and MFA, and Jo checks the network name with airport staff, the likelihood and impact are both low, so the risk is acceptable.', '- When you worry about a threat, ask: "Which of my weaknesses would it need?" Then fix that weakness.
- Use the four responses (reduce, avoid, transfer, accept) consciously.
- Focus on vulnerabilities you control: passwords, updates, settings, and habits.', '[{"question":"A phishing scammer is an example of a:","options":["Threat","Vulnerability","Risk","Countermeasure"],"answer":0,"explanation":"A threat is an actor or event that could cause harm."},{"question":"An app that has not been updated in two years is an example of a:","options":["Threat","Vulnerability","Risk transfer","Asset"],"answer":1,"explanation":"Outdated software may contain known, unpatched flaws, which makes it a vulnerability."},{"question":"Which formula best summarizes risk?","options":["Risk = Threat + Password","Risk ≈ Likelihood × Impact","Risk = Number of devices","Risk = Cost of antivirus"],"answer":1,"explanation":"Risk considers both how likely something is and how damaging it would be."},{"question":"Buying travel insurance for a laptop is an example of which risk response?","options":["Avoid","Accept","Transfer","Ignore"],"answer":2,"explanation":"Insurance transfers some of the financial impact to someone else."}]'),
  (5, 'Understanding Your Digital Footprint', 'Your digital footprint is the trail of information about you that exists online. It has two parts:

- Active footprint: things you share on purpose (posts, photos, comments, profiles).
- Passive footprint: things collected about you, often without you noticing (location history, cookies, app data, data broker profiles, other people tagging you).', 'Pieces of your footprint can be combined to answer security questions, guess passwords, find where you live or work, impersonate you, or build a convincing scam aimed at you or your family. Once something is public, copies may exist that you can no longer delete.', 'Information spreads and gets combined:

- Search engines index public profiles and posts.
- Screenshots and reposts can outlive deleted content.
- Data brokers and "people search" sites compile records from many sources in some countries.
- Photos can contain metadata such as the time and, sometimes, GPS location.
- Friends and family can reveal things about you (tags, comments, group photos).', 'Searching for "Rina Santos" plus her city brings up her public social media profile, a running-club results page showing her usual race times, and a tagged photo outside her apartment building. Together, these reveal where she lives and when she is usually out jogging.

No single item seemed risky, but the combination exposes her routine.', '- Search your own name (and usernames, email, and phone number) to see what is public.
- Review privacy settings on each social account; limit old posts to friends.
- Remove or untag photos that reveal your home, school, or routine.
- Use different usernames for unrelated sites if you do not want them linked.
- Think before posting in real time; post travel photos after you return.
- Delete accounts you no longer use.', '[{"question":"Which is part of your passive digital footprint?","options":["A selfie you posted","A comment you wrote","Location history collected by an app","Your public bio"],"answer":2,"explanation":"Passive footprint data is collected about you, often in the background, rather than shared on purpose."},{"question":"Why can harmless-seeming posts become risky?","options":["They use too much storage","They can be combined to reveal routines, locations, or security answers","Social networks sell them as photos","They slow down your phone"],"answer":1,"explanation":"Attackers combine small details to build a fuller picture of you."},{"question":"A safer way to share vacation photos is to:","options":["Post them live with location tags","Post them after you return home","Post your flight details","Make your account fully public"],"answer":1,"explanation":"Posting after the trip avoids advertising that your home is empty and where you are right now."},{"question":"A good first step to understand your footprint is to:","options":["Search your own name and usernames","Buy a VPN","Change your phone","Delete your email account"],"answer":0,"explanation":"Searching yourself shows what strangers can easily find."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 1
on conflict (module_id, lesson_order) do nothing;

-- Module 2
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'What is Social Engineering?', 'Social engineering is manipulating people, rather than computers, into giving up information, money, or access. Instead of breaking a password, the attacker convinces you to hand it over.', 'People are often the easiest way in. Strong passwords and encryption do not help if you read a one-time code to a caller who claims to be from your bank. Many major incidents have started with a convincing message or phone call.', 'Social engineers typically:

- Research the target (social media, company websites, leaked data).
- Build a believable story (a pretext): delivery company, bank fraud team, IT support, a relative in trouble.
- Create pressure: urgency, fear, authority, or a reward.
- Ask for a specific action: click a link, share a code, send money, install an app, or open a door.

The channel can be email, text message, phone call, chat apps, social media, or in person.', 'A caller says, "This is your bank''s fraud department. We detected a suspicious transfer. To block it, I''ll send a code to your phone; please read it back to verify your identity."

The "code" is actually a one-time password the scammer triggered by logging into the victim''s account. Reading it out gives the scammer access.', '- Never share one-time codes, PINs, or passwords with anyone who contacts you. Legitimate banks and services do not ask for them.
- Hang up and call back using the number on your card or the official website.
- Treat urgency as a warning sign, not a reason to hurry.
- Verify unusual requests from friends or coworkers through a second channel.', '[{"question":"Social engineering mainly targets:","options":["Computer hardware","Human trust and behavior","Wi-Fi routers only","Encryption algorithms"],"answer":1,"explanation":"Social engineering manipulates people into taking actions that help the attacker."},{"question":"A caller from \"your bank\" asks you to read back a code just sent to your phone. What should you do?","options":["Read it quickly to stop the fraud","Hang up and call the bank using the number on your card","Send it by text message instead","Ask them to email it to you"],"answer":1,"explanation":"One-time codes should never be shared. Contact the bank yourself through a trusted number."},{"question":"Which is a common social engineering pressure tactic?","options":["Giving you plenty of time","Urgency or fear","Encouraging you to verify","Using an official helpline you looked up"],"answer":1,"explanation":"Urgency and fear make people skip careful thinking."}]'),
  (2, 'Phishing, Spear Phishing, and Smishing', '- Phishing: fraudulent messages, usually email, sent to many people to steal credentials, money, or install malware.
- Spear phishing: a targeted phishing message tailored to a specific person or group, using details about them.
- Smishing: phishing by SMS or text/chat message.
- Vishing: phishing by voice call.', 'Phishing remains one of the most common ways accounts are compromised and malware is delivered. Text-message scams about deliveries, prizes, bank holds, or e-wallet problems are widespread because people tap links on phones quickly.', 'A phishing message usually links to a fake login page that looks like a real service, or carries an attachment that installs malware. Spear phishing adds personal details (your name, your boss''s name, a real project) to make it believable.

On phones, it is harder to see the real link address, and sender names can be spoofed, so smishing is especially effective.', 'A text arrives: "Your parcel is on hold due to an unpaid fee of 35.00. Pay within 24 hours: parcel-redelivery-help.example." The page asks for card details and then a one-time code "to confirm."

In a spear-phishing version, an email to an accounts clerk appears to come from her manager, mentions a real supplier, and asks her to update the supplier''s bank details before Friday''s payment run.', '- Do not tap links in unexpected messages; open the official app or type the website address yourself.
- Check the real domain carefully (look-alike spellings and extra words are common).
- Be suspicious of small "fees," prizes, or account holds that require immediate action.
- Verify payment-detail changes by phone using a number you already have.
- Use a password manager: it will not auto-fill on a fake domain, which is a useful warning.
- Report phishing to your provider and delete it.', '[{"question":"Smishing is phishing delivered by:","options":["Email","Text or chat message","Postal mail","USB drive"],"answer":1,"explanation":"Smishing combines SMS and phishing."},{"question":"What makes spear phishing different from regular phishing?","options":["It is always sent by phone","It is tailored to a specific person or group using personal details","It never contains links","It is legal"],"answer":1,"explanation":"Spear phishing is targeted and uses research to seem believable."},{"question":"Why can a password manager help detect phishing?","options":["It blocks all emails","It will not auto-fill credentials on a domain that does not match the saved one","It deletes suspicious texts","It calls the bank for you"],"answer":1,"explanation":"Auto-fill is tied to the exact website. If it does not fill, double-check the address."},{"question":"A supplier emails asking to change their bank account for the next payment. Best response?","options":["Update it immediately","Reply to the email to confirm","Call the supplier using a phone number you already had on file","Forward it to a friend"],"answer":2,"explanation":"Replying may reach the attacker. Verify through an independent, known channel."}]'),
  (3, 'Pretexting and Impersonation', 'Pretexting is creating a made-up scenario (a pretext) to get someone to share information or grant access. Impersonation is pretending to be a trusted person or organization, such as IT support, a delivery driver, a government agency, or a family member.', 'People are naturally helpful and respect authority. A believable role can get an attacker past security that would stop a direct request. Impersonation also happens online through fake social media profiles and cloned accounts that message your friends.', 'The attacker gathers enough details to sound legitimate, then plays a role:

- "IT helpdesk" asking you to install remote-access software.
- A "new employee" who forgot their badge and asks you to hold the door.
- A cloned profile of a friend asking to borrow money or for a code "sent to your number by mistake."
- A "government official" threatening fines or arrest unless you pay now.', 'Someone creates a new account using your cousin''s name and profile photo, then messages relatives: "New account, lost my old phone. Can you send me the 6-digit code you''ll receive? It''s for my account recovery."

The code is actually for taking over the relative''s own messaging account.', '- Verify identity through a channel you already trust (call the person, ask a question only they would know).
- Do not install remote-access apps because someone called or messaged you.
- Politely refuse to let unknown people follow you through secure doors; direct them to reception.
- Government agencies and banks generally do not demand immediate payment by gift cards, crypto, or e-wallet transfers.
- Report cloned profiles to the platform and warn your contacts.', '[{"question":"A \"pretext\" in social engineering is:","options":["A type of malware","A made-up story used to justify a request","An encrypted message","A backup file"],"answer":1,"explanation":"The pretext is the believable scenario the attacker uses."},{"question":"A friend''s \"new account\" asks you for a verification code you just received. This is most likely:","options":["A normal request","An account takeover attempt","A software update","A delivery notice"],"answer":1,"explanation":"Codes sent to your number are for your account. Sharing them can let someone take it over."},{"question":"Someone without a badge asks you to hold the office door. The best response is to:","options":["Let them in to be polite","Direct them to reception or security","Give them your badge","Ignore company policy"],"answer":1,"explanation":"Following someone through a secure door is called tailgating. Reception can verify them."}]'),
  (4, 'Recognizing Suspicious Links and Emails', 'This lesson teaches the practical checks you can do on any message before you trust it: who really sent it, where links really go, and whether the request makes sense.', 'Display names, logos, and formatting are easy to fake. The details that are harder to fake, like the actual domain, are what reveal most phishing.', 'Key checks:

- Sender address: the display name can say anything; look at the actual address after the @. "NorthBank Security <alerts@northbank-verify.example>" is not northbank.example.
- Reply-To: a mismatch between From and Reply-To can be a warning sign.
- Link destination: on a computer, hover over the link to preview the real address. On a phone, long-press to preview. Read the domain right-to-left from the first single slash: in "northbank.example.login-secure.example/account", the real domain is "login-secure.example".
- Look-alike characters: "rn" can look like "m", and "0" like "o".
- Attachments: be wary of unexpected files, especially archives, macro-enabled documents, or files that ask you to "enable content."
- Context: Were you expecting this? Does the request match how this organization normally contacts you?', 'An email says: "Your CloudDrive storage is full. Click to keep your files." The sender shows "CloudDrive Support," but the address is support@clouddrive-storage-alert.example, and hovering over the button reveals http://clouddrive.example.account-verify.example/login.

The real domain is account-verify.example, not clouddrive.example. It is phishing.', '- Hover or long-press before clicking.
- Find the real domain (the part just before the first single "/").
- Do not trust a padlock alone; phishing sites can use HTTPS too.
- When unsure, go to the service directly through a bookmark or the official app.
- Report suspicious messages using your email provider''s "Report phishing" option.', '[{"question":"In the link \"https://northbank.example.secure-login.example/verify\", what is the real domain?","options":["northbank.example","secure-login.example","verify","https"],"answer":1,"explanation":"The registered domain is the last part before the first single slash: secure-login.example. \"northbank.example\" is just a subdomain label."},{"question":"The padlock icon (HTTPS) in a browser means:","options":["The website is definitely legitimate","The connection is encrypted, but the site could still be fake","The site has been approved by your bank","The site has no malware"],"answer":1,"explanation":"HTTPS encrypts the connection. Anyone, including scammers, can get a certificate for their own domain."},{"question":"How can you preview a link on a phone?","options":["Tap it quickly","Long-press it","Shake the phone","Forward it to yourself"],"answer":1,"explanation":"Long-pressing usually shows the destination without opening it."},{"question":"Which attachment request is a strong warning sign?","options":["A PDF receipt you expected","A document that asks you to \"enable content\" or macros","A photo from a family member you were waiting for","A calendar invite from your known coworker"],"answer":1,"explanation":"Macros can run code. Unexpected requests to enable them are a common malware delivery method."},{"question":"An email shows the display name \"IT Support\" but the address is from an unknown domain. You should:","options":["Trust the display name","Treat it as suspicious and verify through your real IT department","Reply with your password","Click the link to check"],"answer":1,"explanation":"Display names are trivial to fake. The actual address and an independent check matter."}]'),
  (5, 'Psychological Manipulation Tactics', 'Attackers rely on well-known principles of persuasion and emotion. Recognizing these levers helps you notice manipulation while it is happening.', 'Smart, careful people still fall for scams when they are rushed, scared, excited, or tired. Knowing the tactics lets you pause at the right moment.', 'Common levers:

- Urgency: "Act within 1 hour or your account will be closed."
- Fear: threats of arrest, fines, or losing money.
- Authority: pretending to be a boss, police, bank, or government.
- Scarcity / reward: "Only 3 slots left," "You have won a prize."
- Social proof: "Everyone in your team has already done this."
- Liking and familiarity: friendly chat, shared interests, flattery, or romance built over weeks.
- Reciprocity: doing you a small favor first so you feel you owe them.
- Commitment: getting a small "yes" first, then escalating the request.', 'An online "investment mentor" is friendly for weeks, shares screenshots of profits, and helps with a small first investment that appears to grow. Then the mentor urges a much larger deposit "before the window closes." When the victim tries to withdraw, they are told to pay "taxes" or "fees" first.

This uses liking, social proof, commitment, and urgency together.', '- Name the emotion: "I feel rushed / scared / excited. Why?"
- Introduce a pause: legitimate requests can wait while you verify.
- Talk it through with someone you trust before sending money.
- Be very cautious of investment or romance contacts who only exist online and steer you to transfers or crypto.
- If you must pay a fee to receive a prize or withdraw money, it is a scam warning sign.', '[{"question":"\"Your account will be suspended in 30 minutes\" mainly uses:","options":["Reciprocity","Urgency","Liking","Scarcity of products"],"answer":1,"explanation":"A tight deadline is designed to make you act before thinking."},{"question":"Being asked to pay a fee to withdraw your own investment \"profits\" is a sign of:","options":["A normal bank process","A likely scam","High interest rates","Tax law"],"answer":1,"explanation":"Demanding new payments before releasing funds is a common scam pattern."},{"question":"Which is the most effective general defense against manipulation?","options":["Responding as fast as possible","Pausing and verifying through an independent channel","Trusting anyone who sounds official","Keeping it secret from family"],"answer":1,"explanation":"Manipulation depends on rushing you. Pausing and verifying breaks the pattern."}]'),
  (6, 'Avoiding Online Scams', 'Online scams are schemes that trick you into sending money, goods, or personal data. Common types include fake online shops, marketplace scams, job and task scams, romance scams, investment scams, prize scams, and tech-support scams.', 'Scams cause large financial losses and are often hard to reverse, especially when payment is made by bank transfer, e-wallet, gift cards, or cryptocurrency. Victims also lose personal data that can be reused in later scams.', 'Typical patterns:

- Fake shops: prices far below normal, new websites, pressure to pay by direct transfer.
- Marketplace scams: "buyers" who overpay and ask for a refund, or "sellers" who want payment outside the platform.
- Task/job scams: easy pay for liking videos or rating products, then a demand to "top up" to unlock earnings.
- Tech-support scams: pop-ups or calls claiming your computer is infected, asking you to call a number or install remote-access software.
- Recovery scams: people offering to recover money you lost to an earlier scam, for a fee.', 'Ben applies for an online "part-time job" that pays for completing simple tasks. After a few small payouts, he is told he must deposit money to unlock a higher-paying "premium task." The balance shown on the site grows, but withdrawals are always blocked until he pays more.

The early payouts were bait to build trust.', '- If an offer is far better than normal, research it before paying.
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
  (1, 'Strong Passwords', 'A strong password is long, unique to one account, and hard to guess, even for a computer trying billions of guesses.', 'Weak or reused passwords are one of the most common reasons accounts get taken over.', 'Attackers guess passwords using lists of common and leaked passwords plus predictable patterns (Name2024!, qwerty). Length adds the most strength: each extra character multiplies the number of possibilities. A passphrase of four or more random, unrelated words is both strong and memorable.

Current NIST guidance (SP 800-63B) favors length and checking against breached-password lists over forced complexity rules and routine periodic changes.', 'Kim uses "Summer2025!" everywhere. It meets most complexity rules but follows a very common pattern and appears in guessing lists, so it falls quickly in an offline attack.', '- Use at least 12–16 characters; longer for important accounts.
- Use a random passphrase or let a password manager generate one.
- Never reuse passwords across accounts.
- Change a password when there is a reason (a breach or suspicion), not on a fixed calendar.', '[{"question":"Which usually adds the most strength to a password?","options":["Adding one symbol","Making it longer","Capitalizing the first letter","Adding the current year"],"answer":1,"explanation":"Length increases the number of possible combinations the most."},{"question":"Why is \"Summer2025!\" weak?","options":["It is too long","It follows a common, predictable pattern","It has no letters","It is random"],"answer":1,"explanation":"Season + year + symbol is a pattern attackers try early."},{"question":"Reusing one strong password on many sites is:","options":["Safe if it is long","Risky, because one breach exposes every account","Recommended","Required by MFA"],"answer":1,"explanation":"Reuse lets one leak unlock many accounts."}]'),
  (2, 'Password Managers', 'A password manager is an app that generates, stores, and auto-fills unique passwords for you, protected by one strong master password (and ideally MFA).', 'It is practically impossible to remember dozens of unique strong passwords. A manager makes "unique everywhere" achievable.', 'Your vault is encrypted on your device with a key derived from your master password. Reputable managers are designed so the provider cannot read your vault. Browser extensions and apps auto-fill only on the domain the password was saved for, which also helps catch phishing.', 'After a breach at a shopping site, Paolo only has to change that one site''s password, because his manager gave every account a different one.', '- Choose a well-known, actively maintained password manager.
- Protect it with a long, unique master passphrase and MFA.
- Store your recovery/emergency kit somewhere safe offline.
- Move your most important accounts (email, banking) in first.', '[{"question":"What protects a password manager''s vault?","options":["Nothing","Encryption tied to your master password","Your phone number only","The website''s security"],"answer":1,"explanation":"The vault is encrypted using a key derived from your master password."},{"question":"Why can a password manager help against phishing?","options":["It blocks emails","It only auto-fills on the matching domain","It changes your IP","It scans attachments"],"answer":1,"explanation":"If auto-fill does not trigger, the site may be fake."},{"question":"The master password should be:","options":["Short and simple","Long, unique, and not used anywhere else","Your email password","Written on your monitor"],"answer":1,"explanation":"It guards everything else, so it must be strong and unique."}]'),
  (3, 'Multi-Factor Authentication (MFA)', 'MFA requires two or more kinds of proof to log in: something you know (password), something you have (phone, security key), or something you are (fingerprint, face).', 'With MFA, a stolen password alone is usually not enough to break in.', 'Common methods, roughly from weaker to stronger: SMS codes, email codes, authenticator-app codes (TOTP), push approvals with number matching, and passkeys or hardware security keys (FIDO2/WebAuthn). SMS can be undermined by SIM-swap attacks. Codes and push approvals can still be phished or abused by "MFA fatigue" spam, while passkeys and security keys are designed to resist phishing because they are bound to the real website.', 'An attacker with Dee''s password triggers repeated login push prompts at 2 a.m., hoping she taps "Approve" to make them stop. She denies them and changes her password.', '- Turn on MFA for email, banking, e-wallets, and social media first.
- Prefer passkeys, security keys, or an authenticator app over SMS when available.
- Never approve a login prompt you did not start.
- Save backup codes somewhere safe.', '[{"question":"Which is generally the most phishing-resistant MFA option?","options":["SMS code","Email code","Passkey or hardware security key","Security question"],"answer":2,"explanation":"Passkeys and FIDO2 keys are bound to the real site, so fake sites cannot use them."},{"question":"You get a login approval prompt you did not request. You should:","options":["Approve it","Deny it and change your password","Ignore it forever","Forward it"],"answer":1,"explanation":"An unexpected prompt suggests someone has your password."},{"question":"A known weakness of SMS codes is:","options":["They are too long","SIM-swap attacks can redirect them","They need internet","They cannot be typed"],"answer":1,"explanation":"Attackers can sometimes trick carriers into moving your number to their SIM."}]'),
  (4, 'Account Recovery Security', 'Account recovery is how you regain access when you forget a password or lose a device: recovery email, phone number, backup codes, and security questions.', 'Attackers often skip your strong password and attack the weaker recovery path instead.', 'If your recovery email is old or insecure, or your security answers are on social media, an attacker can reset your password. Recovery phone numbers can be hijacked by SIM swaps.', 'Lina''s security question was "Mother''s maiden name." Her mother''s maiden name appears in public family posts, so an attacker answered it and reset her account.', '- Keep recovery emails and phone numbers current and secured with MFA.
- Treat security questions like passwords: use random answers stored in your password manager.
- Store backup codes offline.
- Ask your mobile carrier about a SIM/port-out PIN or lock if offered.', '[{"question":"Why do attackers target recovery options?","options":["They are often weaker than the main password","They are encrypted","They are illegal to use","They expire"],"answer":0,"explanation":"A weak recovery path bypasses a strong password."},{"question":"A good answer to a security question is:","options":["The true, public answer","A random answer saved in your password manager","Your birthday","Leave it blank"],"answer":1,"explanation":"True answers are often findable; random ones are not."},{"question":"Backup codes should be stored:","options":["In a public post","Somewhere safe, such as offline or in your password manager","In your email subject line","Nowhere"],"answer":1,"explanation":"They are a key to your account and must be kept private."}]'),
  (5, 'Credential Stuffing and Brute-Force Attacks', '- Brute force: trying many possible passwords until one works.
- Credential stuffing: taking email/password pairs leaked from one site and automatically trying them on other sites.', 'Huge lists of leaked credentials circulate online. If you reuse passwords, stuffing can unlock your accounts without any guessing.', 'Online attacks against a login page are slowed by rate limits and lockouts. Offline attacks happen when attackers steal a database of password hashes and guess at very high speed on their own hardware, which is why long unique passwords matter. Stuffing uses bots that rotate IP addresses to avoid detection.', 'A streaming service notices thousands of logins from different IPs, each using credentials leaked from an unrelated site. Accounts with reused passwords are hijacked and resold.', '- Use unique passwords everywhere (password manager).
- Enable MFA.
- Check breach-notification services such as Have I Been Pwned for your email.
- Change any password that appears in a known breach.', '[{"question":"Credential stuffing relies mainly on:","options":["Password reuse","Long passphrases","MFA","Encryption"],"answer":0,"explanation":"It reuses leaked pairs on other sites."},{"question":"An \"offline\" attack means attackers:","options":["Must be at your house","Guess against stolen password hashes on their own hardware","Need your phone","Use only email"],"answer":1,"explanation":"Offline guessing is not slowed by website lockouts."},{"question":"Best single defense against credential stuffing?","options":["Unique passwords per site","Changing your username","Clearing cookies","Using incognito"],"answer":0,"explanation":"A leaked password from one site will not work elsewhere."}]'),
  (6, 'Protecting Your Digital Identity', 'Your digital identity is the set of accounts, identifiers, and records that prove who you are online: email, phone number, government IDs, financial accounts, and social profiles.', 'Identity theft lets criminals open accounts, take loans, or commit fraud in your name, and it can take a long time to clean up.', 'Thieves combine leaked data, phishing, and public information. Photos of IDs, selfies holding IDs, and copies sent over chat are especially valuable to them.', 'Rafa sends a photo of his ID to a "seller" to "verify" a marketplace deal. The image is later used in an attempt to open an online loan account.', '- Share ID copies only with verified organizations, and watermark them with the purpose and date when possible.
- Monitor bank and e-wallet statements and enable transaction alerts.
- Use a separate email for important accounts.
- Where available in your country, consider credit monitoring or a credit freeze.', '[{"question":"Which is most valuable to an identity thief?","options":["A weather app","A photo of your government ID","Your favorite color","A public news article"],"answer":1,"explanation":"ID images can be used to impersonate you."},{"question":"Watermarking an ID copy helps by:","options":["Making it illegal to view","Limiting reuse for other purposes","Encrypting it","Deleting it later"],"answer":1,"explanation":"A purpose/date watermark makes misuse harder and more obvious."},{"question":"Transaction alerts help you:","options":["Spend more","Spot unauthorized activity quickly","Avoid MFA","Hide accounts"],"answer":1,"explanation":"Early detection limits damage."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 3
on conflict (module_id, lesson_order) do nothing;

-- Module 4
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Operating System Updates', 'Updates are fixes and improvements from your device or software maker, including security patches for known flaws.', 'Once a flaw is publicly fixed, attackers can study the patch and target devices that have not updated.', 'Patches close vulnerabilities in the operating system, browser, and apps. Devices that no longer receive security updates ("end of life") stay vulnerable permanently.', 'A ransomware campaign spreads through a flaw that was patched months earlier. Updated computers are unaffected; unpatched ones are encrypted.', '- Turn on automatic updates for your OS, browser, and apps.
- Restart when prompted so updates finish installing.
- Check whether your phone or computer still receives security updates.
- Uninstall apps you no longer use.', '[{"question":"Why delay in updating is risky:","options":["Updates slow devices","Attackers target known, already-fixed flaws","Updates delete data","It is not risky"],"answer":1,"explanation":"Published fixes reveal what to attack on unpatched devices."},{"question":"An \"end-of-life\" device:","options":["Gets extra updates","No longer receives security patches","Is always safe","Is brand new"],"answer":1,"explanation":"Without patches, new flaws stay open."},{"question":"Which should be updated?","options":["Only the OS","OS, browser, and apps","Only games","Nothing"],"answer":1,"explanation":"Any software can contain vulnerabilities."}]'),
  (2, 'Malware, Spyware, Ransomware, and Trojans', '- Malware: any malicious software.
- Spyware: secretly monitors activity, messages, or location.
- Ransomware: encrypts or locks your files and demands payment.
- Trojan: malware disguised as something useful.', 'Malware can steal passwords and money, spy on you, or destroy your files.', 'Malware usually arrives through phishing attachments, fake or pirated software, malicious ads, or apps from unofficial sources. Stalkerware may be installed by someone with physical access to your phone.', 'A free "video downloader" from an unofficial site works as promised but also installs a password-stealing trojan.', '- Install software only from official stores or developer sites.
- Avoid pirated software and "cracks."
- Keep devices updated and use built-in security tools.
- Keep backups to recover from ransomware.', '[{"question":"A trojan is malware that:","options":["Spreads only by USB","Disguises itself as legitimate software","Only affects phones","Is harmless"],"answer":1,"explanation":"Like the Trojan horse, it hides inside something wanted."},{"question":"Ransomware typically:","options":["Shows ads","Encrypts files and demands payment","Speeds up your PC","Updates apps"],"answer":1,"explanation":"It holds your data hostage."},{"question":"A common malware source is:","options":["Official app stores","Pirated software and cracks","OS updates","Your password manager"],"answer":1,"explanation":"Cracked software is a common carrier for malware."}]'),
  (3, 'Antivirus and Endpoint Protection', 'Antivirus and endpoint protection software detect and block known and suspicious malicious activity on your device.', 'It is a safety net that can catch threats your other habits miss.', 'Modern tools combine signature detection (known malware) with behavior monitoring (suspicious actions, such as mass file encryption). Windows includes Microsoft Defender, and macOS includes built-in protections such as XProtect and Gatekeeper.', 'An employee opens a malicious attachment. Endpoint protection detects the file trying to encrypt documents and stops the process.', '- Keep built-in protection turned on and updated.
- Run only one real-time antivirus to avoid conflicts.
- Do not disable protection because a download "asks" you to.
- Remember it is a layer, not a guarantee.', '[{"question":"Behavior-based detection looks for:","options":["File names only","Suspicious actions like mass encryption","Your password","Screen brightness"],"answer":1,"explanation":"It flags malicious behavior even from unknown files."},{"question":"A download that asks you to disable antivirus is:","options":["Normal","A strong warning sign","Required","Safer"],"answer":1,"explanation":"Malware often tries to switch off protection."},{"question":"Antivirus should be treated as:","options":["A complete solution","One layer of defense","Unnecessary","A replacement for updates"],"answer":1,"explanation":"Defense in depth uses several layers."}]'),
  (4, 'Disk Encryption', 'Full-disk encryption scrambles everything stored on a device so it can only be read after you unlock it with your password, PIN, or key.', 'If your laptop or phone is lost or stolen, encryption keeps your files private.', 'Modern phones encrypt storage when a passcode is set. Computers use tools such as BitLocker or Device Encryption (Windows) and FileVault (macOS). Protection applies when the device is powered off or locked; a stolen unlocked device is still exposed.', 'Two laptops are stolen from a car. One has FileVault enabled; its data is unreadable. The other is unencrypted, and the thief can remove the drive and read every file.', '- Set a strong passcode on your phone.
- Turn on BitLocker/Device Encryption or FileVault.
- Store the recovery key safely; losing it can mean losing your data.
- Lock or shut down devices when unattended.', '[{"question":"Disk encryption mainly protects data when:","options":["The device is lost or stolen","You are browsing","You send email","You charge it"],"answer":0,"explanation":"It protects data at rest on the device."},{"question":"FileVault is the built-in encryption for:","options":["Windows","macOS","Android","Routers"],"answer":1,"explanation":"FileVault is Apple''s macOS disk encryption."},{"question":"Why store the recovery key safely?","options":["It is decorative","Without it, you may permanently lose access to your data","It speeds up boot","It is not needed"],"answer":1,"explanation":"The recovery key is your backup way in."}]'),
  (5, 'USB Safety', 'USB devices, including flash drives and cables, can carry malware or be built to act maliciously when plugged in.', 'Unknown USB drives have been used to deliver malware, and some devices can pretend to be a keyboard and type commands.', 'A drive can contain infected files. Specially built devices can emulate a keyboard and run commands within seconds. Public charging ports carry a theoretical risk of data access ("juice jacking"), which charge-only cables or your own adapter avoid.', 'A USB drive labeled "Salaries 2026" is left in a company parking lot. A curious employee plugs it in, and it installs remote-access malware.', '- Never plug in USB drives you found or did not expect.
- Use your own charger and power adapter, or a charge-only cable, in public places.
- Disable autorun features and scan removable drives.
- Give found drives to IT, not your computer.', '[{"question":"You find a USB drive in a parking lot. You should:","options":["Plug it in to find the owner","Hand it to IT/security without plugging it in","Keep it","Format it on your PC"],"answer":1,"explanation":"Found drives are a known attack method."},{"question":"Some malicious USB devices can:","options":["Only store photos","Pretend to be a keyboard and type commands","Charge faster","Fix viruses"],"answer":1,"explanation":"Keystroke-injection devices act like keyboards."},{"question":"A safer way to charge in public is:","options":["Any unknown cable","Your own adapter and cable, or a charge-only cable","Bluetooth","Borrowing a stranger''s laptop"],"answer":1,"explanation":"Using your own power adapter avoids data connections."}]'),
  (6, 'Secure Device Configuration', 'Secure configuration means adjusting device settings to reduce risk: screen lock, app permissions, Bluetooth, sharing settings, and installed apps.', 'Default settings often favor convenience over privacy and security.', 'Every enabled feature or permission is a possible way in. Reducing unnecessary permissions and services shrinks your "attack surface."', 'A flashlight app requests access to contacts, location, and the microphone. None are needed for a flashlight, so the request is a red flag.', '- Use a strong screen lock and short auto-lock time.
- Review app permissions (location, camera, microphone, contacts) regularly.
- Turn off Bluetooth, AirDrop/Nearby Share, and file sharing when not needed, or limit them to contacts.
- Remove unused apps.
- Enable "Find My" or "Find My Device."', '[{"question":"\"Attack surface\" refers to:","options":["Screen size","All the ways a system could be attacked","Battery life","Case material"],"answer":1,"explanation":"Fewer features and permissions mean fewer entry points."},{"question":"A flashlight app asking for contacts access is:","options":["Necessary","A red flag","Required by law","Normal for all apps"],"answer":1,"explanation":"Permissions should match what the app actually does."},{"question":"Which helps if your phone is lost?","options":["Disabling the lock","Enabling Find My / Find My Device","Turning off updates","Removing the SIM PIN"],"answer":1,"explanation":"It lets you locate, lock, or erase the device."}]'),
  (7, 'Physical Device Security', 'Physical security means protecting devices from being stolen, tampered with, or viewed by others.', 'Someone with physical access can read your screen, install stalkerware, or steal the device itself.', 'Risks include shoulder surfing, unattended unlocked devices, theft in public places, and tampering. Encryption and screen locks reduce the damage; awareness prevents many incidents.', 'At a café, a person behind Mia watches her type her phone PIN, then later snatches the phone and unlocks it.', '- Lock your screen whenever you step away (Windows+L, Ctrl+Cmd+Q on Mac).
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
  (1, 'How the Internet Works', 'The internet is a global network of networks that sends data in small packets between devices using shared rules called protocols (such as TCP/IP).', 'Understanding the basics shows where your data travels and who can see it along the way.', 'Your device connects to a router, then to your internet service provider (ISP), then through many other networks to the server. DNS translates names like example.com into IP addresses. Without encryption, anyone along the path could read the data; with HTTPS, they mostly see where you connect, not what you send.', 'When Joy visits her bank''s website, her request passes her home router, her ISP, and several other networks before reaching the bank. HTTPS keeps the content private along that route.', '- Use HTTPS sites (most browsers can warn or upgrade automatically).
- Remember that your network provider can usually see which sites or services you connect to.
- Keep your home router secure (see the router lesson).', '[{"question":"DNS is used to:","options":["Encrypt email","Translate domain names into IP addresses","Block ads","Store passwords"],"answer":1,"explanation":"DNS is like the internet''s address book."},{"question":"Data travels across the internet in:","options":["One big file","Small packets","Radio only","Letters"],"answer":1,"explanation":"Data is split into packets and reassembled."},{"question":"With HTTPS, your ISP can generally see:","options":["Your passwords","Which site you connect to, but not page contents","Everything you type","Nothing at all"],"answer":1,"explanation":"HTTPS hides contents, but connection metadata is still visible."}]'),
  (2, 'Public Wi-Fi Risks', 'Public Wi-Fi is any network shared with strangers: cafés, airports, hotels, malls.', 'You do not control the network, and you do not know who else is on it.', 'Risks include fake "evil twin" hotspots with convincing names, fake captive-portal login pages, and attacks against devices on the same network. Widespread HTTPS has reduced the risk of simple eavesdropping, but fake portals and unpatched devices are still concerns.', 'At an airport, Leo connects to "Airport_Free_WiFi_Fast." It is a hotspot run from someone''s laptop that shows a fake login page asking for his email password.', '- Confirm the official network name with staff.
- Never enter account passwords on a Wi-Fi sign-in page.
- Prefer your mobile data or hotspot for sensitive tasks.
- Set public networks as "Public" so file sharing is off.
- Forget networks after use to avoid auto-reconnecting.', '[{"question":"An \"evil twin\" is:","options":["A backup router","A fake hotspot imitating a real one","A VPN","A firewall rule"],"answer":1,"explanation":"It lures users with a familiar or appealing name."},{"question":"A Wi-Fi sign-in page asks for your email password. You should:","options":["Enter it","Refuse; that is not normal","Use a different password","Restart"],"answer":1,"explanation":"Captive portals should not need your account credentials."},{"question":"For banking on the go, a safer option is usually:","options":["Any open Wi-Fi","Your mobile data","A shared computer","An unknown hotspot"],"answer":1,"explanation":"Mobile data avoids the shared network."}]'),
  (3, 'VPNs: What They Do and Don''t Do', 'A VPN (Virtual Private Network) creates an encrypted tunnel between your device and a VPN server, which then connects to websites for you.', 'VPNs are often marketed as complete privacy solutions. Knowing their limits avoids false confidence.', 'A VPN hides your traffic from the local network and your ISP and shows websites the VPN''s IP address instead of yours. However, the VPN provider can now see your connection metadata, so you shift trust to them. A VPN does not stop phishing, malware, tracking by logged-in accounts, or browser fingerprinting, and it does not make you anonymous.', 'Nico uses a VPN on café Wi-Fi, which protects him from the local network. He is still tracked by the social site he is logged into, and a VPN would not have stopped the phishing link he nearly clicked.', '- Use a VPN when you do not trust the local network, or for work access if required.
- Choose a reputable provider with a clear privacy policy and independent audits; be cautious of free VPNs that monetize your data.
- Do not rely on a VPN for anonymity or malware protection.', '[{"question":"A VPN mainly protects you from:","options":["Phishing","The local network and ISP seeing your traffic","All tracking","Malware"],"answer":1,"explanation":"It encrypts traffic between you and the VPN server."},{"question":"When you use a VPN, who can see your connection metadata?","options":["No one","The VPN provider","Only you","Only the website"],"answer":1,"explanation":"You shift trust from your ISP to the VPN provider."},{"question":"Does a VPN make you anonymous?","options":["Yes, completely","No; logins, cookies, and fingerprinting still identify you","Only on weekends","Only on mobile"],"answer":1,"explanation":"Many tracking methods do not depend on your IP address."}]'),
  (4, 'DNS and HTTPS', '- DNS converts names (example.com) into IP addresses.
- HTTPS is HTTP secured with TLS encryption, protecting data between your browser and a website.', 'Unprotected DNS can reveal which sites you visit and can be manipulated; HTTPS prevents eavesdropping and tampering with page contents.', 'Traditional DNS queries are unencrypted. DNS over HTTPS (DoH) and DNS over TLS (DoT) encrypt them. HTTPS uses certificates to prove the server controls the domain, but a certificate does not prove the site is honest; scammers can get certificates for their own look-alike domains.', 'On a compromised network, an attacker tampers with DNS so a bank name resolves to a fake server. Because the attacker cannot get a valid certificate for the real bank domain, the browser shows a certificate warning, which the user should not bypass.', '- Do not click through certificate warnings on sensitive sites.
- Enable "HTTPS-Only" or "Always use secure connections" in your browser.
- Consider enabling encrypted DNS (DoH) in your browser or OS.
- Remember: padlock = encrypted connection, not proof of legitimacy.', '[{"question":"DNS over HTTPS (DoH) does what?","options":["Speeds up downloads","Encrypts DNS queries","Blocks all ads","Replaces passwords"],"answer":1,"explanation":"It hides DNS lookups from the local network."},{"question":"A certificate warning on your bank''s site means you should:","options":["Click \"proceed anyway\"","Stop and not continue","Refresh until it disappears","Disable HTTPS"],"answer":1,"explanation":"It may indicate interception or a fake site."},{"question":"HTTPS proves that:","options":["The site is honest","The connection is encrypted to the server for that domain","The site has no malware","The site is government-approved"],"answer":1,"explanation":"It authenticates the domain, not the owner''s intentions."}]'),
  (5, 'Router Security', 'Your home router connects your devices to the internet and is the front door of your home network.', 'A compromised router can redirect traffic, spy on devices, or be used in botnets.', 'Routers often ship with default admin passwords, outdated firmware, and features such as WPS or remote management turned on. Attackers scan the internet for routers with these weaknesses.', 'An old router still uses the default admin password printed on its label. Malware logs in, changes its DNS settings, and sends household devices to fake websites.', '- Change the router admin password from the default.
- Update firmware, or replace routers that no longer receive updates.
- Use WPA3, or WPA2-AES if WPA3 is unavailable, with a strong Wi-Fi password.
- Disable WPS and remote administration if you do not need them.
- Use a separate guest network for visitors and smart devices.', '[{"question":"Which Wi-Fi security setting is best if supported?","options":["WEP","Open","WPA3","WPS"],"answer":2,"explanation":"WPA3 is the current standard; WEP is broken."},{"question":"Why change the router''s default admin password?","options":["Defaults are often known or easy to find","It increases speed","It is decorative","It updates firmware"],"answer":0,"explanation":"Attackers try default credentials automatically."},{"question":"A guest network is useful for:","options":["Making Wi-Fi faster","Separating visitors and smart devices from your main devices","Removing passwords","Disabling updates"],"answer":1,"explanation":"Segmentation limits what a compromised device can reach."}]'),
  (6, 'Network Sniffing and Man-in-the-Middle Attacks', '- Sniffing: capturing network traffic to read it.
- Man-in-the-middle (MITM): secretly sitting between two parties to read or alter their communication.', 'Unencrypted traffic can reveal passwords, messages, and session data.', 'On shared networks, attackers can try ARP spoofing, rogue access points, or DNS tampering to position themselves in the middle. Encryption such as HTTPS and certificate checks make intercepted data unreadable and reveal many tampering attempts.', 'At a conference, an attacker sets up a rogue access point. Users who ignore certificate warnings on a login page have their credentials captured.', '- Use HTTPS everywhere and heed certificate warnings.
- Prefer trusted networks or mobile data for sensitive activity.
- Keep devices updated.
- Use a VPN on networks you do not trust.', '[{"question":"A man-in-the-middle attacker:","options":["Breaks your screen","Secretly intercepts communication between two parties","Only sends spam","Repairs networks"],"answer":1,"explanation":"They sit between you and the destination."},{"question":"What makes sniffed traffic far less useful?","options":["Encryption such as HTTPS","A bigger screen","Faster Wi-Fi","Bluetooth"],"answer":0,"explanation":"Encrypted data is unreadable without keys."},{"question":"A certificate warning during login might indicate:","options":["A normal page","Possible interception","A faster site","A software update"],"answer":1,"explanation":"MITM attempts often trigger certificate errors."}]'),
  (7, 'Firewall Fundamentals', 'A firewall controls which network connections are allowed into or out of a device or network, based on rules.', 'It blocks unwanted incoming connections that could exploit services on your device.', 'Your router typically blocks unsolicited incoming connections from the internet. Operating systems include host firewalls (Windows Defender Firewall, macOS Application Firewall) that can block apps or services, especially on public networks.', 'A laptop with file sharing turned on joins hotel Wi-Fi. Because the network is set to "Public," the firewall blocks other guests from reaching the shared folders.', '- Keep your OS firewall turned on.
- Mark untrusted networks as Public.
- Only allow apps through the firewall when you understand why.
- Avoid opening router ports unless necessary.', '[{"question":"A firewall''s job is to:","options":["Speed up the internet","Allow or block connections based on rules","Store passwords","Scan photos"],"answer":1,"explanation":"It filters network traffic."},{"question":"Setting a network to \"Public\" usually:","options":["Turns off security","Applies stricter firewall rules and disables sharing","Shares your files","Disables Wi-Fi"],"answer":1,"explanation":"Public profiles are more restrictive."},{"question":"Opening router ports should be done:","options":["Always","Only when necessary and understood","Never possible","For speed"],"answer":1,"explanation":"Each open port exposes a service to the internet."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 5
on conflict (module_id, lesson_order) do nothing;

-- Module 6
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Browser Fingerprinting', 'Browser fingerprinting identifies your browser by combining many small details: screen size, fonts, time zone, language, graphics hardware, and settings.', 'It can track you across sites even without cookies and even when you change IP address.', 'Each detail is common, but the combination can be rare enough to recognize you. Scripts collect these values and compute an identifier. Some browsers reduce fingerprinting by standardizing or randomizing values.', 'Sam clears cookies daily and uses a VPN, yet ad networks still recognize his browser because its combination of fonts, extensions, and settings is unusual.', '- Use a browser with fingerprinting protections (for example, Firefox, Brave, or Tor Browser).
- Avoid installing many unusual extensions, which can make you more unique.
- Keep browser privacy protections enabled.
- Accept that complete protection is difficult.', '[{"question":"Fingerprinting can track you:","options":["Only with cookies","Even without cookies","Only offline","Only on phones"],"answer":1,"explanation":"It uses device and browser characteristics instead of stored files."},{"question":"Installing many rare extensions may:","options":["Make you less unique","Make your fingerprint more unique","Have no effect","Block all tracking"],"answer":1,"explanation":"Unusual configurations stand out."},{"question":"A VPN alone stops fingerprinting:","options":["True","False"],"answer":1,"explanation":"Fingerprinting does not rely on your IP address."}]'),
  (2, 'Cookies and Tracking', 'Cookies are small files websites store in your browser. First-party cookies come from the site you visit (keeping you logged in); third-party cookies come from other domains, often advertisers, and can track you across sites.', 'Tracking builds detailed profiles of your interests, habits, and sometimes sensitive topics.', 'Trackers use cookies, pixels, scripts, and logged-in accounts to link your activity. Many browsers now restrict third-party cookies by default, but trackers also use other techniques.', 'After reading about a medical condition on a health site, Nina sees related ads on unrelated websites and social media.', '- Block third-party cookies in your browser settings.
- Use tracker-blocking browsers or reputable extensions.
- Reject non-essential cookies in consent banners.
- Log out of, or separate, accounts used for sensitive browsing.', '[{"question":"Third-party cookies are mainly used for:","options":["Keeping you logged in on the same site","Tracking across different sites","Encrypting traffic","Speeding up pages"],"answer":1,"explanation":"They are set by domains other than the one you are visiting."},{"question":"A tracking pixel is:","options":["A screen defect","A tiny embedded image or script that reports your visit","A password","A firewall"],"answer":1,"explanation":"Pixels quietly signal that content was loaded."},{"question":"Being logged into a large platform while browsing can:","options":["Prevent tracking","Help that platform link your activity","Delete cookies","Hide your IP"],"answer":1,"explanation":"Logged-in identity is a strong tracking signal."}]'),
  (3, 'Search Engine Privacy', 'Search engines can log your queries, IP address, and clicks, and link them to your account.', 'Searches can reveal health concerns, finances, relationships, and plans.', 'Search history may be stored and used for personalization and ads. Privacy-focused search engines (for example, DuckDuckGo, Startpage, or Brave Search) say they do not build personal search profiles. Check each provider''s current policy.', 'Tom searches for symptoms and loan options while logged into his account. That history is saved and visible to anyone who later accesses his account.', '- Review and auto-delete search history in your account settings.
- Use a privacy-focused search engine for sensitive topics.
- Search while logged out when appropriate.', '[{"question":"Search queries can reveal:","options":["Nothing","Health, financial, and personal interests","Only weather","Your password"],"answer":1,"explanation":"Queries are very personal data."},{"question":"One way to limit stored search history is:","options":["Searching more","Turning on auto-delete in account settings","Using all caps","Using more tabs"],"answer":1,"explanation":"Many providers offer history controls."},{"question":"Privacy-focused search engines claim to:","options":["Hack trackers","Not build personal search profiles","Replace browsers","Block all ads everywhere"],"answer":1,"explanation":"Read each provider''s policy to understand its claims."}]'),
  (4, 'Metadata and EXIF Data', 'Metadata is data about data. EXIF metadata in photos can include the camera model, date and time, and sometimes GPS coordinates.', 'A photo can reveal where you live or where you were, even if the image itself shows nothing identifying.', 'Phones may embed location in photos if location access is enabled for the camera. Many large social platforms remove EXIF data on upload, but files sent as documents, by email, or through some apps and websites may keep it. Documents can also contain author names and edit history.', 'Someone sells an item online and attaches original photos taken at home. The files still contain GPS coordinates that point to their house.', '- Turn off location tagging for your camera app if you do not need it.
- Remove location before sharing (most phones offer an option in the share sheet).
- Check document properties for author names before sending.
- Assume the original file contains more than you can see.', '[{"question":"EXIF data can include:","options":["GPS location","Your bank PIN","Your browser history","Nothing useful"],"answer":0,"explanation":"Photos can contain location coordinates."},{"question":"Do all sharing methods remove EXIF?","options":["Yes, always","No; some keep the original file''s metadata","Only email removes it","Only USB"],"answer":1,"explanation":"Behavior varies by platform and method."},{"question":"A simple way to reduce photo metadata risk is:","options":["Taking blurrier photos","Disabling camera location tagging","Using bigger files","Renaming files"],"answer":1,"explanation":"If location is never recorded, it cannot leak."}]'),
  (5, 'Location Sharing Risks', 'Location sharing includes live location in maps or messaging apps, check-ins, location-tagged posts, and fitness apps that record routes.', 'Real-time or habitual location data can expose your home, routine, and when you are away.', 'Apps may share location continuously with contacts or publicly. Fitness apps can reveal start and end points of runs, often your home.', 'A runner''s public fitness profile shows the same route each morning starting and ending at one address, revealing where they live and when they leave.', '- Review which apps have "Always" location access and reduce it to "While using" or "Never."
- Share live location only with trusted people and for a limited time.
- Set privacy zones around your home in fitness apps.
- Avoid real-time location tags in public posts.', '[{"question":"Fitness app routes can reveal:","options":["Your home and routine","Nothing","Only distance","Your password"],"answer":0,"explanation":"Start and end points often reveal your home."},{"question":"A safer location permission for most apps is:","options":["Always","While using the app","Shared publicly","Shared with everyone"],"answer":1,"explanation":"Limit background access to what is needed."},{"question":"Privacy zones in fitness apps:","options":["Hide the parts of routes near chosen places","Make routes public","Speed up GPS","Delete the app"],"answer":0,"explanation":"They mask sensitive start and end points."}]'),
  (6, 'Social Media Privacy', 'Social media privacy is control over who can see your posts, profile details, friends list, and tagged content.', 'Profiles are a main source for scammers, stalkers, and identity thieves.', 'Default settings often make content public. Old posts, tagged photos, and friend lists can reveal relationships, schools, workplaces, and routines.', 'A scammer studies a person''s public family photos and names, then messages their grandparent pretending to be that person in an emergency.', '- Run each platform''s privacy checkup.
- Limit old posts to friends.
- Hide your friends list and contact details.
- Require approval for tags.
- Think about who could see a post before sharing.', '[{"question":"A public friends list can help scammers:","options":["Do nothing","Identify family and contacts to target or impersonate","Improve your privacy","Block spam"],"answer":1,"explanation":"It maps your relationships."},{"question":"Requiring tag approval:","options":["Lets you review posts that mention you before they appear on your profile","Deletes your account","Makes everything public","Has no effect"],"answer":0,"explanation":"It gives you control over tagged content."},{"question":"A good regular habit is:","options":["Making all posts public","Running the platform''s privacy checkup","Sharing your phone number","Accepting all friend requests"],"answer":1,"explanation":"Settings and defaults change over time."}]'),
  (7, 'Tor, Private Browsing, and Anonymity Misconceptions', '- Private/incognito browsing: does not save history, cookies, or form data on your device after you close the window.
- Tor Browser: routes traffic through three volunteer relays to hide your IP address from sites and your network provider from your destinations.', 'Many people overestimate what these tools do, which leads to risky behavior.', 'Incognito does not hide your activity from websites, your employer or school network, or your ISP. Tor provides strong network anonymity, but logging into personal accounts, sharing identifying details, or downloading and opening files can still reveal who you are. The Tor exit relay can see traffic that is not encrypted with HTTPS.', 'Ana uses incognito mode at work, believing her employer cannot see what sites she visits. The company network logs every connection regardless.', '- Use incognito to avoid leaving history on a shared device, not for anonymity.
- If you use Tor, do not log into personal accounts and keep using HTTPS.
- Remember that behavior (what you say and log into) often identifies you more than technology does.', '[{"question":"Incognito mode prevents:","options":["Your ISP from seeing your activity","Local history from being saved after closing","Websites from seeing you","Malware"],"answer":1,"explanation":"It is a local privacy feature only."},{"question":"How many relays does a typical Tor circuit use?","options":["One","Three","Ten","None"],"answer":1,"explanation":"Tor circuits use guard, middle, and exit relays."},{"question":"What can still reveal your identity on Tor?","options":["Logging into personal accounts","Using HTTPS","Closing the browser","Using default settings"],"answer":0,"explanation":"Logging in tells the site exactly who you are."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 6
on conflict (module_id, lesson_order) do nothing;

-- Module 7
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Identifying Your Threat Model', 'A threat model is a structured description of what you are protecting, from whom, and how much effort it is worth.', 'Security advice is not one-size-fits-all. A journalist, a small business owner, and a student face different threats.', 'Answer five questions: What do I want to protect? Who do I want to protect it from? How likely is it that I will need to protect it? How bad are the consequences if I fail? How much trouble am I willing to go through to prevent them? (These questions are adapted from EFF''s Surveillance Self-Defense guide.)', 'Mara''s main concern is an ex-partner who knows her old passwords and devices. Her threat model leads her to change passwords, check for stalkerware, review location sharing, and log out of all sessions, rather than buying expensive tools.', '- Write down your top assets and adversaries.
- Match protections to realistic threats.
- Revisit your model when your situation changes.
- Use the Threat Modeling Simulator in Labs to practice.', '[{"question":"A threat model starts with:","options":["Buying tools","What you want to protect","Deleting accounts","Changing ISPs"],"answer":1,"explanation":"You must first know your assets."},{"question":"Why is threat modeling personal?","options":["Everyone faces the same threats","Different people have different assets and adversaries","It is required by law","It is not personal"],"answer":1,"explanation":"Protections should match your actual risks."},{"question":"Which is part of a threat model?","options":["How much trouble you will accept to prevent harm","Your favorite app color","Your phone brand only","Your typing speed"],"answer":0,"explanation":"Effort and cost matter in choosing protections."}]'),
  (2, 'Risk Assessment', 'Risk assessment is ranking risks by likelihood and impact so you can decide what to fix first.', 'You have limited time and money. Assessment focuses effort on the biggest risks.', 'List threats and vulnerabilities, rate each for likelihood and impact (for example, 1–3), and multiply. Address high scores first, and accept or monitor low scores.', 'Jun rates "email takeover" as likely (3) and severe (3) = 9, and "laptop theft at home" as unlikely (1) but severe (3) = 3. He secures his email with MFA first.', '- Use a simple likelihood × impact grid.
- Fix the highest scores first.
- Re-assess after big changes.
- Document decisions so you remember why you made them.', '[{"question":"Likelihood 3 × Impact 2 gives a score of:","options":["5","6","1","32"],"answer":1,"explanation":"3 × 2 = 6."},{"question":"Which risk should be addressed first?","options":["Score 2","Score 9","Score 4","Score 1"],"answer":1,"explanation":"Highest likelihood × impact first."},{"question":"Low-score risks can be:","options":["Ignored forever without thought","Accepted or monitored consciously","Always fixed first","Made public"],"answer":1,"explanation":"Accepting a small risk is a valid, deliberate choice."}]'),
  (3, 'Compartmentalization', 'Compartmentalization means separating parts of your digital life so a problem in one area does not spread to others.', 'If everything is linked to one email and one password, a single breach exposes everything.', 'Use separate emails, browsers or browser profiles, devices, or accounts for different purposes: banking, work, shopping, social, and sign-ups.', 'Lia uses one email for banking, another for shopping and newsletters. When a shopping site is breached, phishing floods that inbox, but her banking email remains unknown to attackers.', '- Use a dedicated email for financial accounts.
- Use email aliases or a secondary address for sign-ups.
- Separate work and personal devices or accounts.
- Use different browser profiles for different activities.', '[{"question":"Compartmentalization limits:","options":["Internet speed","How far a single breach can spread","Battery life","Screen time"],"answer":1,"explanation":"Separation contains damage."},{"question":"A dedicated email for banking helps because:","options":["It is free","Fewer people know it, so it receives fewer targeted attacks","It removes MFA","It is faster"],"answer":1,"explanation":"Less exposure means less targeting."},{"question":"Which is a form of compartmentalization?","options":["Using one password everywhere","Separate browser profiles for work and personal use","Sharing accounts","Posting everything publicly"],"answer":1,"explanation":"Profiles keep cookies and logins separate."}]'),
  (4, 'The Need-to-Know Principle', 'Need-to-know means sharing information only with people who actually need it to do their part.', 'Every extra person who knows something is another possible leak, by accident or on purpose.', 'Before sharing, ask: Does this person need this specific information? Do they need all of it? For how long? This applies to family plans, work data, and passwords.', 'An office shares the admin password for its main account in a group chat with 40 people. When one member''s phone is stolen, the password is exposed.', '- Share the minimum information needed.
- Use password managers'' sharing features instead of chat messages.
- Remove access when people no longer need it.
- Avoid discussing sensitive plans in public places.', '[{"question":"Need-to-know means:","options":["Tell everyone for transparency","Share only with those who need it, and only what they need","Never share anything","Share publicly"],"answer":1,"explanation":"Minimize who knows and how much."},{"question":"A safer way to share a password with a coworker is:","options":["Group chat","A password manager''s secure sharing feature","Email subject line","Sticky note"],"answer":1,"explanation":"Secure sharing can be controlled and revoked."},{"question":"When someone no longer needs access, you should:","options":["Leave it","Remove their access","Give more access","Post the password"],"answer":1,"explanation":"Regularly review and revoke access."}]'),
  (5, 'Information Classification', 'Information classification means labeling information by how sensitive it is, so you know how to handle it.', 'Treating everything the same leads to either overprotecting trivial data or underprotecting critical data.', 'A simple personal scheme: Public (fine to share), Internal (family/friends only), Confidential (ID numbers, finances, health), and Restricted (passwords, recovery codes, private keys). Each level has handling rules.', 'Ella classifies her scanned passport as Confidential: stored encrypted, never sent over chat, and shared only with verified organizations when required.', '- Define three or four levels for your own information.
- Decide where each level may be stored and how it may be shared.
- Encrypt Confidential and Restricted data.
- Shred or securely delete sensitive data you no longer need.', '[{"question":"Recovery codes would most likely be classified as:","options":["Public","Internal","Restricted","Unimportant"],"answer":2,"explanation":"They grant direct access to accounts."},{"question":"Why classify information?","options":["To apply the right protection to the right data","To make files bigger","For fun only","To share more"],"answer":0,"explanation":"Protection should match sensitivity."},{"question":"Confidential data should usually be:","options":["Posted online","Stored encrypted and shared only when necessary","Sent in group chats","Printed and left out"],"answer":1,"explanation":"Sensitive data needs stronger handling rules."}]'),
  (6, 'Secure Communication', 'Secure communication protects the content of your messages and calls from being read by others, and helps confirm who you are talking to.', 'Messages can contain sensitive details. Interception, compromised accounts, or the wrong recipient can expose them.', 'End-to-end encryption (E2EE) means only the sender and recipients can read messages; the service provider cannot. Signal uses E2EE by default; WhatsApp also uses E2EE for chats. Regular SMS is not end-to-end encrypted. Even with E2EE, metadata (who you talk to and when) may still be visible to the provider, and anyone who can open your unlocked phone can read your messages.', 'Two colleagues verify each other''s Signal safety numbers in person before discussing a confidential project, confirming no one is impersonating either of them.', '- Prefer E2EE messengers for sensitive conversations.
- Verify safety numbers or security codes for important contacts.
- Use disappearing messages where appropriate.
- Protect devices with strong locks; E2EE does not protect an unlocked phone.', '[{"question":"End-to-end encryption means:","options":["The provider can read messages","Only the sender and recipients can read messages","Messages are public","No internet is needed"],"answer":1,"explanation":"Keys exist only on participants'' devices."},{"question":"Regular SMS is:","options":["End-to-end encrypted","Not end-to-end encrypted","Anonymous","Untraceable"],"answer":1,"explanation":"SMS can be accessed by carriers and sometimes intercepted."},{"question":"Even with E2EE, what may still be visible to the provider?","options":["Message content","Metadata such as who you talk to and when","Your password","Nothing"],"answer":1,"explanation":"Metadata can still be revealing."}]'),
  (7, 'OpSec Failures and Real-World Case Studies', 'Studying real incidents shows how small mistakes lead to large consequences.', 'Case studies make abstract advice concrete and memorable.', 'Common themes: oversharing (public fitness or photo data), weak or reused credentials without MFA, social engineering of support staff, and third-party access. The Reference Hub includes case summaries such as the 2018 fitness heatmap revelations, the 2020 Twitter phone-spear-phishing incident, and the 2021 Colonial Pipeline ransomware attack.', 'In January 2018, researchers noticed that a fitness app''s public global heatmap revealed activity patterns around sensitive military locations, because personnel recorded their runs with default sharing settings.', '- For each case, ask: What was the critical information? Which vulnerability was used? What simple countermeasure would have helped?
- Apply the same questions to your own habits.', '[{"question":"The 2018 fitness heatmap issue was mainly caused by:","options":["A data breach","Users sharing activity data with default/public settings","Ransomware","A router flaw"],"answer":1,"explanation":"The data was shared publicly through normal app features."},{"question":"A common lesson across many incidents is:","options":["Small, ordinary mistakes can have big effects","Only experts make mistakes","Security tools always prevent breaches","Nothing can be learned"],"answer":0,"explanation":"Basic failures often enable major incidents."},{"question":"When studying a case, a useful question is:","options":["Who is to blame?","What simple countermeasure would have helped?","How famous was it?","How expensive was it?"],"answer":1,"explanation":"Focus on lessons you can apply."}]')
) as v(lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
where m.module_number = 7
on conflict (module_id, lesson_order) do nothing;

-- Module 8
insert into public.lessons (module_id, lesson_order, title, what_is_it, why_it_matters, how_it_works, real_world_scenario, how_to_protect, quiz_json)
select m.id, v.lesson_order, v.title, v.what_is_it, v.why_it_matters, v.how_it_works, v.real_world_scenario, v.how_to_protect, v.quiz_json::jsonb
from public.modules m, (values
  (1, 'Recognizing Compromised Accounts', 'A compromised account is one that someone else has accessed or controls without your permission.', 'Spotting compromise early limits damage to you and to contacts who might be scammed in your name.', 'Warning signs: login alerts you did not trigger, password reset emails you did not request, sent messages or posts you did not make, changed recovery details, unfamiliar devices or sessions, and contacts reporting strange messages from you.', 'Friends tell Carlo that "he" asked them for money on a chat app. He checks his active sessions and finds an unknown device logged in from another country.', '- Review active sessions and devices regularly.
- Turn on login alerts.
- Act immediately on warning signs: change the password, sign out of all sessions, enable MFA, and check recovery options.', '[{"question":"Which is a sign of account compromise?","options":["A login alert you did not trigger","A normal newsletter","Your own post","A software update"],"answer":0,"explanation":"Unexpected login alerts should be investigated."},{"question":"Where can you often see unknown devices?","options":["Active sessions or device list in account settings","Your phone wallpaper","Calculator","Camera roll"],"answer":0,"explanation":"Most major services list active sessions."},{"question":"First steps after suspected compromise include:","options":["Waiting a week","Changing the password and signing out all sessions","Deleting your phone","Posting about it publicly first"],"answer":1,"explanation":"Cut off the attacker''s access quickly."}]'),
  (2, 'Steps After a Data Breach', 'A data breach is when an organization''s data, possibly including yours, is accessed or leaked without authorization.', 'Leaked details can be used for credential stuffing, phishing, and identity fraud.', 'Find out what data was exposed (email, password, phone, ID numbers, payment details). The right response depends on what leaked.', 'An online shop announces a breach of emails and hashed passwords. Mika changes that password, and any other account where she reused it, and watches for phishing emails mentioning the shop.', '- Read the official breach notice to learn what leaked.
- Change the affected password and any reused copies.
- Enable MFA.
- Watch for targeted phishing referencing the breach.
- If payment or ID data leaked, contact your bank and monitor statements.', '[{"question":"After a breach, which passwords should you change?","options":["None","The breached site''s password and anywhere you reused it","Only your Wi-Fi password","Your phone PIN only"],"answer":1,"explanation":"Reused passwords are at risk everywhere."},{"question":"Why expect more phishing after a breach?","options":["Attackers can use leaked details to make messages convincing","Breaches stop phishing","Email providers send more ads","They do not"],"answer":0,"explanation":"Leaked data fuels targeted scams."},{"question":"The response depends mostly on:","options":["What data was exposed","The weather","Your phone brand","The time of day"],"answer":0,"explanation":"Different data requires different actions."}]'),
  (3, 'Securing a Compromised Device', 'A compromised device has malware, stalkerware, or unauthorized access.', 'A compromised device can capture new passwords as you type them, so you must clean it or use another device for recovery.', 'Signs include unknown apps, unusual battery drain or data use, disabled security settings, or pop-ups. Remediation ranges from removing apps and running security scans to a full factory reset.', 'Dani suspects stalkerware after her ex knew details from her private messages. She contacts a support organization for advice, then changes passwords from a different trusted device before deciding how to deal with the phone.', '- Use a known-clean device to change important passwords.
- Update the OS, remove unknown apps, and run security scans.
- If in doubt, back up personal files (not apps) and factory reset.
- If you suspect stalkerware, consider your safety first; removing it may alert the person who installed it. Seek help from specialized support organizations.', '[{"question":"Why change passwords from a different device?","options":["It is faster","The compromised device may capture new passwords","It is required by law","It saves battery"],"answer":1,"explanation":"Keyloggers or spyware could record new credentials."},{"question":"A strong remediation for a badly infected device is:","options":["Ignoring it","Factory reset after backing up personal files","Changing the wallpaper","Turning off Wi-Fi only"],"answer":1,"explanation":"A reset removes most software-based compromise."},{"question":"Before removing suspected stalkerware, you should:","options":["Consider personal safety, since removal may alert the abuser","Post about it","Ignore it","Share your password"],"answer":0,"explanation":"Safety planning matters in abuse situations."}]'),
  (4, 'Account Recovery Procedures', 'Account recovery procedures are the official steps a service provides to regain control of an account you have lost.', 'Knowing the official route in advance saves time and helps you avoid fake "recovery" services.', 'Most providers offer recovery forms, identity verification, backup codes, or trusted contacts. Recovery may take days. Use only official help pages, which you should reach by typing the address yourself or through the official app.', 'After losing access to his social media account, Ken searches online and finds a "recovery expert" asking for payment. He instead uses the platform''s official recovery form and backup codes.', '- Save backup codes and keep recovery info current before you need it.
- Use only official help pages and in-app options.
- Never pay strangers to recover accounts.
- After recovery: change the password, review sessions, enable MFA, and check for changes the attacker made.', '[{"question":"A stranger offers to recover your account for a fee. This is likely:","options":["Official support","A scam","Required","Free help"],"answer":1,"explanation":"Recovery scams target people in distress."},{"question":"What should you do after regaining access?","options":["Nothing","Change the password, review sessions, enable MFA, and check settings","Delete your email","Share the password"],"answer":1,"explanation":"Remove the attacker''s foothold and changes."},{"question":"When is the best time to set up recovery options?","options":["After losing access","Before you need them","Never","Only on holidays"],"answer":1,"explanation":"Preparation makes recovery possible."}]'),
  (5, 'Backups and Disaster Recovery', 'A backup is a separate copy of your data that you can restore after loss, theft, hardware failure, or ransomware.', 'Without backups, a single incident can permanently erase photos, documents, and work.', 'The 3-2-1 rule: keep 3 copies of your data, on 2 different types of storage, with 1 copy off-site (for example, in the cloud or another location). Keep at least one backup disconnected or versioned so ransomware cannot encrypt it too. Test restoring occasionally.', 'Ransomware encrypts Rico''s laptop and the external drive that was plugged in. His cloud backup with version history lets him restore files from before the attack.', '- Follow the 3-2-1 rule.
- Use cloud backup with version history and an external drive you disconnect after backing up.
- Test restoring a file periodically.
- Back up phone photos and two-factor recovery codes too.', '[{"question":"In the 3-2-1 rule, the \"1\" means:","options":["One password","One copy off-site","One device","One day"],"answer":1,"explanation":"An off-site copy survives local disasters."},{"question":"Why keep a backup disconnected?","options":["To save power","So ransomware cannot encrypt it too","It is faster","No reason"],"answer":1,"explanation":"Connected drives can be encrypted along with the computer."},{"question":"Why test restoring?","options":["To confirm backups actually work","To waste time","It deletes old files","It is not useful"],"answer":0,"explanation":"Untested backups may fail when needed."}]'),
  (6, 'Reporting Cybercrime', 'Reporting cybercrime means notifying the right organizations: your bank or e-wallet, the platform involved, and law enforcement or a national cybercrime authority.', 'Fast reporting can sometimes freeze stolen funds, take down scam accounts, and help protect others.', 'Contact your bank or e-wallet first if money is involved, since transfers may sometimes be stopped if reported quickly. Report the account or message to the platform. Then file a report with the relevant authority. In the Philippines, the Cybercrime Investigation and Coordinating Center (CICC) runs the 24/7 Inter-Agency Response Center hotline 1326; the PNP Anti-Cybercrime Group and NBI Cybercrime Division also receive complaints. In the United States, reports go to the FBI''s Internet Crime Complaint Center (ic3.gov). Check your own country''s official channels.', 'Within minutes of realizing she was scammed, Liza calls her e-wallet provider to report the transfer, reports the scammer''s profile to the platform, and files a report with the national cybercrime hotline, keeping screenshots as evidence.', '- Act quickly when money is involved.
- Keep evidence: screenshots, transaction IDs, usernames, phone numbers, links, and dates.
- Report to your bank or e-wallet, the platform, and the official cybercrime authority.
- Beware of fake "recovery" agents who contact you after you report.', '[{"question":"If money was stolen, who should you usually contact first?","options":["Your bank or e-wallet provider","A recovery agent you found online","No one","The scammer"],"answer":0,"explanation":"Quick reporting may allow a transfer to be stopped."},{"question":"Which evidence should you keep?","options":["Screenshots, transaction IDs, usernames, links, and dates","Nothing","Only your feelings","Only the final balance"],"answer":0,"explanation":"Details help investigators and providers."},{"question":"In the Philippines, the CICC''s 24/7 cybercrime hotline number is:","options":["911","1326","8888","117"],"answer":1,"explanation":"The Inter-Agency Response Center hotline is 1326."}]'),
  (7, 'Building Your Personal OpSec Checklist', 'A personal OpSec checklist is a short list of security habits and settings tailored to your own threat model.', 'A checklist turns knowledge into action and helps you keep habits over time.', 'Combine what you learned: protect critical accounts, secure devices, manage your footprint, prepare for incidents. Review it every few months and after big life changes.', 'Ivy builds her checklist: password manager set up, MFA on email and banking, phone encrypted with a strong PIN, backups weekly, privacy settings reviewed, recovery codes stored. She sets a calendar reminder to review it quarterly.', '- Use the Security Checklist on your Dashboard; it syncs to your account.
- Start with high-impact items: email MFA, unique passwords, updates, backups.
- Add items specific to your threat model.
- Review every 3–6 months.', '[{"question":"A personal checklist should be:","options":["Identical for everyone","Tailored to your threat model","Kept secret from yourself","Done once and forgotten"],"answer":1,"explanation":"Your risks shape your checklist."},{"question":"Which is a high-impact first item?","options":["Changing wallpaper","Enabling MFA on your email","Buying a new phone","Deleting all apps"],"answer":1,"explanation":"Email protects most other accounts."},{"question":"How often should you review your checklist?","options":["Never","Every few months and after major changes","Every hour","Only after being hacked"],"answer":1,"explanation":"Regular reviews keep it current."}]')
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

insert into public.glossary_terms (term, definition, category) values
  ('OpSec', 'Operational Security: a process for identifying critical information and protecting it from people who could misuse it.', 'Fundamentals'),
  ('Threat', 'A person, group, or event that could cause harm, such as a scammer, malware, or a thief.', 'Fundamentals'),
  ('Vulnerability', 'A weakness that a threat could exploit, such as a reused password or outdated software.', 'Fundamentals'),
  ('Risk', 'The likelihood that a threat exploits a vulnerability, combined with the impact if it does.', 'Fundamentals'),
  ('Threat Model', 'A description of what you are protecting, from whom, how likely and severe the harm is, and how much effort protection is worth.', 'Fundamentals'),
  ('Digital Footprint', 'The trail of data about you online, both shared on purpose (active) and collected about you (passive).', 'Privacy'),
  ('Social Engineering', 'Manipulating people into revealing information, sending money, or granting access.', 'Human Threats'),
  ('Phishing', 'Fraudulent messages designed to steal credentials or money, or to deliver malware.', 'Human Threats'),
  ('Spear Phishing', 'Phishing targeted at a specific person or group using personal details.', 'Human Threats'),
  ('Smishing', 'Phishing by SMS or chat message.', 'Human Threats'),
  ('Vishing', 'Phishing by voice call.', 'Human Threats'),
  ('Pretexting', 'Using a made-up scenario to persuade someone to share information or take an action.', 'Human Threats'),
  ('Tailgating', 'Following an authorized person through a secure door without authenticating.', 'Physical'),
  ('Shoulder Surfing', 'Watching someone''s screen or keypad to steal information.', 'Physical'),
  ('MFA', 'Multi-Factor Authentication: requiring two or more types of proof (know, have, are) to log in.', 'Accounts'),
  ('Passkey', 'A phishing-resistant login credential based on public-key cryptography (FIDO2/WebAuthn) stored on your device or password manager.', 'Accounts'),
  ('Password Manager', 'An app that generates, stores, and fills unique passwords in an encrypted vault.', 'Accounts'),
  ('Credential Stuffing', 'Automatically trying leaked username/password pairs on other websites.', 'Accounts'),
  ('Brute-Force Attack', 'Trying many possible passwords until one works.', 'Accounts'),
  ('SIM Swap', 'Tricking a mobile carrier into moving your phone number to an attacker''s SIM card.', 'Accounts'),
  ('Entropy', 'A measure of unpredictability. In passwords, more bits of entropy mean more possible guesses are needed.', 'Accounts'),
  ('Malware', 'Any software designed to harm, spy on, or take control of a device.', 'Devices'),
  ('Ransomware', 'Malware that encrypts or locks data and demands payment.', 'Devices'),
  ('Trojan', 'Malware disguised as legitimate software.', 'Devices'),
  ('Spyware', 'Software that secretly monitors activity. Stalkerware is spyware used to monitor a partner or person without consent.', 'Devices'),
  ('Patch', 'A software update that fixes bugs or security vulnerabilities.', 'Devices'),
  ('Full-Disk Encryption', 'Encrypting all data on a storage device so it is unreadable without the unlock key.', 'Devices'),
  ('Attack Surface', 'All the points where an attacker could try to enter or extract data from a system.', 'Devices'),
  ('VPN', 'Virtual Private Network: an encrypted tunnel between your device and a VPN server.', 'Network'),
  ('DNS', 'Domain Name System: translates domain names into IP addresses.', 'Network'),
  ('HTTPS', 'HTTP over TLS: encrypts traffic between your browser and a website and authenticates the domain.', 'Network'),
  ('Man-in-the-Middle (MITM)', 'An attack where someone secretly intercepts or alters communication between two parties.', 'Network'),
  ('Evil Twin', 'A rogue Wi-Fi access point that imitates a legitimate one.', 'Network'),
  ('Firewall', 'A system that allows or blocks network connections based on rules.', 'Network'),
  ('End-to-End Encryption (E2EE)', 'Encryption where only the communicating users can read the messages, not the service provider.', 'Network'),
  ('Metadata', 'Data about data, such as who sent a message and when, or where a photo was taken.', 'Privacy'),
  ('EXIF', 'Metadata stored in image files: camera, time, and sometimes GPS location.', 'Privacy'),
  ('Browser Fingerprinting', 'Identifying a browser by combining many of its characteristics, without cookies.', 'Privacy'),
  ('Third-Party Cookie', 'A cookie set by a domain other than the site you are visiting, often used for cross-site tracking.', 'Privacy'),
  ('Tor', 'A network that routes traffic through multiple volunteer relays to hide your IP address from destinations.', 'Privacy'),
  ('Compartmentalization', 'Separating accounts, devices, or identities so a compromise in one area does not spread.', 'Practical OpSec'),
  ('Need-to-Know', 'Sharing information only with those who require it for their role.', 'Practical OpSec'),
  ('Data Breach', 'Unauthorized access to or disclosure of an organization''s data.', 'Incident Response'),
  ('3-2-1 Backup Rule', 'Keep 3 copies of data, on 2 types of storage, with 1 copy off-site.', 'Incident Response')
on conflict (term) do nothing;

-- ---------------------------------------------------------------------
-- 9. MAKE YOURSELF AN ADMIN (run separately after you sign up in the app)
-- update public.profiles set role = 'admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------
