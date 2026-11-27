# OpSec for Dummies

> "Security isn't about knowing everything. It's about knowing what to protect, what can go wrong, and how to minimize the risks."

An educational web app that teaches ordinary people to protect their information, devices, accounts, and identity.
Static frontend + Vercel Serverless Functions + Supabase (Postgres, Auth, RLS, Realtime).

## What's inside

```
public/                 Static frontend (HTML, CSS, vanilla ES modules)
  js/app.js             Boot, auth session listener, hash router, nav
  js/supabaseClient.js  Loads /api/config, creates supabase-js; apiFetch() / adminFetch()
  vendor/supabase-js.js supabase-js browser build, pinned and self-hosted (npm run vendor)
  js/checklistLogic.js  Security Checklist items + stage logic (baseline → final)
  js/views/             dashboard, checklist, lesson (6-part + quiz), module mythbusters,
                        labs hub, reference (case studies), admin
  js/labs/              phishing, password, threatModel, spotRisk (100% client-side)
api/
  config.js             GET  /api/config → public URL + anon key from env
  admin/lessons.js      GET (with answer keys) / POST / PUT / DELETE  (Bearer JWT → admin check → validated)
  admin/users.js        GET roster analytics / PATCH role
  quiz/submit.js        POST: grades a quiz on the server and saves progress
  _lib/                 shared auth + validation (underscore = not a route)
supabase/
  schema.sql            ← run this in the Supabase SQL Editor (tables, trigger, RLS, grants, seed)
  ddl.sql, seed/*.mjs   sources for schema.sql (npm run build:schema)
tests/                  node:test unit tests for API, lab, and checklist logic (npm test)
docs/RESEND_SMTP.md     connect Resend as Supabase Auth's SMTP server
vercel.json             output dir, function config, security headers + CSP
```

**Content:** 8 modules · 52 lessons (Modules 1–2 fully written; 3–8 structured starters with complete 6-part content and 3-question quizzes for admins to expand) · 3 Mythbusters per module · 15 daily tips · 6 case studies with source links.

## Learning journey

1. **Before you start.** After signing up (and every sign-in until it's done), users land on the **Security Checklist** and record the habits they already have. Saving it locks in their *baseline*; they then go straight to Module 1. Lessons show a reminder until the baseline exists.
2. **Modules.** Each module's lessons end with that module's **Mythbusters** (myths vs. facts), stored in `modules.myths_json`.
3. **After all 8 modules.** The dashboard and the final quiz show a celebration prompt that sends users back to the checklist. It starts from their baseline answers; they update it and **lock in** their practices. The page compares before vs. now.

Checklist data: `user_checklists` (one row per user × `stage` (`baseline`/`final`) × item) and `user_checklist_status` (when each stage was saved, and its score). A trigger stops a saved baseline from being changed.

## Setup

1. **Create a Supabase project** → SQL Editor → paste all of `supabase/schema.sql` → Run. It is safe to re-run; it won't overwrite lessons you've edited.
2. **Auth email and URLs:** follow [docs/RESEND_SMTP.md](docs/RESEND_SMTP.md) to send sign-up, password-reset, and magic-link emails through Resend, and to set the *Site URL* and *Redirect URLs* (including `https://your-app/?auth=recovery` via a `/**` wildcard).
3. **Deploy to Vercel**: import the repo (Framework preset: *Other*). Add environment variables from `.env.example`:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Redeploy.
4. **Make yourself admin**: sign up in the app, then in the SQL Editor run
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
   Refresh the app and the **Admin Portal** tab appears.

Local dev: `npm install`, copy `.env.example` → `.env.local`, then `npx vercel dev`.

## Security design

- **RLS on every table.** Content tables: read for signed-in users (except `lessons.quiz_json`, see below), write for admins only. Checklists: users read and write their own rows only. Quiz progress: users can only read their own rows; the server writes them. Admins read all. `anon` can only read `case_studies` (public teaching material).
- **No self-promotion.** A `BEFORE UPDATE` trigger on `profiles` blocks non-admins from changing `role` (RLS alone would let users edit their own row).
- **`is_admin()`** is `SECURITY DEFINER` with an empty `search_path` to avoid RLS recursion and search-path hijacking.
- **Admin API defense in depth.** Each route verifies the JWT with `auth.getUser()`, re-checks `profiles.role`, validates input (3–5 questions, 2–6 options, valid answer index, length limits), and blocks admins from demoting themselves.
- **Service-role key** stays in Vercel env vars; `/api/config` returns only the public URL and anon key.
- **Server-side quiz grading.** Browsers can't read `lessons.quiz_json` (column-level grants), so answer keys never reach the page before an attempt; the page gets questions from `public.lesson_quiz()`. `POST /api/quiz/submit` verifies the user's JWT, grades the answers, keeps the best score, and writes `user_progress` with the service role. Users have **read-only** access to `user_progress`, so scores and completion can't be faked from the browser console, and admin analytics reflect real attempts. Correct answers and explanations are returned only after an attempt.
- **No third-party scripts.** supabase-js is pinned to an exact version in `package.json` and served from `/vendor/supabase-js.js`. The CSP allows scripts from `self` only. To upgrade: change the pinned version, `npm install`, `npm run vendor`, and commit the new vendor file.
- **XSS:** all database text is HTML-escaped before rendering, and case-study links are rendered only if they are `https:` URLs (opened with `rel="noopener noreferrer"`).
- **Auth emails** go through Resend SMTP configured in the Supabase Dashboard; the Resend key is never in this repo or in Vercel. The password-reset form says the same thing whether or not an account exists.
- **Password lab** never stores or transmits input, and the field is cleared when you leave the page.

> If you use a custom Supabase domain, add it to `connect-src` in `vercel.json`'s CSP.

## Testing done

- Original prototype (before the updates below, some features since changed or removed): `supabase/schema.sql` executed twice on PostgreSQL 16 with a mocked `auth` schema, with RLS checks (role escalation blocked, students can't write lessons or other users' progress, anon denied); 14 unit tests; and a stubbed browser run of the labs, sign-in, dashboard, admin lesson edit, role toggle, mobile nav, and sign-out.
- Checklist / Mythbusters / case-study / auth update (2026-11-26): `npm test` (20 tests, including checklist stage logic and https-only link handling), plus a browser run against an in-memory Supabase stub: login redirect to the baseline checklist, saving and locking the baseline, the dashboard without roadmap or checklist, module Mythbusters after each module's last lesson, case-study links (new tab, `noopener noreferrer`), the completion prompt after the final quiz, the before-vs-now re-evaluation, show/hide password toggles, forgot-password, magic link, the reset form, and expired-link handling. No console errors.
- Server grading and self-hosted supabase-js (2026-11-26): `npm test` (25 tests, including quiz submit auth, grading, best-score retention, ignoring client-sent scores, input validation, and admin-only answer keys), plus a browser run: the vendored library loads with no CDN, the quiz form contains no answers, submit goes to the API with the session token, and feedback, completion, and the end-of-course prompt use the server's result.
- **Not tested:** the updated `schema.sql` against Postgres (re-run it on a Supabase branch or staging project first), Resend email delivery, or a live Vercel deployment. Do a quick smoke test after deploying.

## Upgrading an existing database

Re-run `supabase/schema.sql`. It hides `lessons.quiz_json` from signed-in users, adds `lesson_quiz()`, and removes users' insert/update rights on `user_progress` (existing progress is kept). **Deploy the new frontend and API at the same time**: the old lesson page writes progress directly and would stop saving scores. It also adds the checklist `stage` column (existing checklist rows become each user's baseline), `user_checklist_status`, `modules.myths_json`, and `case_studies`, and fills myths only for modules that have none. The old `glossary_terms` table is left in place so nothing is deleted; drop it yourself if you no longer want it:

```sql
drop table if exists public.glossary_terms;
```

## Content accuracy notes

Lessons are general educational guidance. Facts to re-check before publishing widely, because they can change: the Philippines CICC hotline (1326), the US IC3 reference, NIST SP 800-63B password guidance, and the case-study summaries and links in `supabase/seed/extras.mjs`, which are based on widely reported public accounts. The links were checked on 2026-11-26.
