# OpSec for Dummies

> "Security isn't about knowing everything. It's about knowing what to protect, what can go wrong, and how to minimize the risks."

An educational web app that teaches ordinary people to protect their information, devices, accounts, and identity.
Static frontend + Vercel Serverless Functions + Supabase (Postgres, Auth, RLS, Realtime).

## What's inside

```
public/                 Static frontend (HTML, CSS, vanilla ES modules)
  js/app.js             Boot, auth session listener, hash router, nav
  js/supabaseClient.js  Loads /api/config, creates supabase-js (esm.sh CDN); adminFetch()
  js/views/             dashboard, lesson (6-part + quiz), labs hub, reference, admin
  js/labs/              phishing, password, threatModel, spotRisk (100% client-side)
api/
  config.js             GET  /api/config → public URL + anon key from env
  admin/lessons.js      POST/PUT/DELETE  (Bearer JWT → admin check → validated mutation)
  admin/users.js        GET roster analytics / PATCH role
  _lib/                 shared auth + validation (underscore = not a route)
supabase/
  schema.sql            ← run this in the Supabase SQL Editor (tables, trigger, RLS, grants, seed)
  ddl.sql, seed/*.mjs   sources for schema.sql (npm run build:schema)
tests/                  node:test unit tests for API and lab logic (npm test)
vercel.json             output dir, function config, security headers + CSP
```

**Content:** 8 modules · 52 lessons (Modules 1–2 fully written; 3–8 structured starters with complete 6-part content and 3-question quizzes for admins to expand) · 15 daily tips · 44 glossary terms.

## Setup

1. **Create a Supabase project** → SQL Editor → paste all of `supabase/schema.sql` → Run. It is safe to re-run; it won't overwrite lessons you've edited.
2. **Auth settings** (Supabase → Authentication → URL Configuration): set *Site URL* to your Vercel URL so confirmation emails link back correctly.
3. **Deploy to Vercel**: import the repo (Framework preset: *Other*). Add environment variables from `.env.example`:
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Redeploy.
4. **Make yourself admin**: sign up in the app, then in the SQL Editor run
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
   Refresh the app and the **Admin Portal** tab appears.

Local dev: `npm install`, copy `.env.example` → `.env.local`, then `npx vercel dev`.

## Security design

- **RLS on every table.** Content tables: read for signed-in users, write for admins only. Progress/checklists: users read and write their own rows only; admins read all. `anon` has no table access.
- **No self-promotion.** A `BEFORE UPDATE` trigger on `profiles` blocks non-admins from changing `role` (RLS alone would let users edit their own row).
- **`is_admin()`** is `SECURITY DEFINER` with an empty `search_path` to avoid RLS recursion and search-path hijacking.
- **Admin API defense in depth.** Each route verifies the JWT with `auth.getUser()`, re-checks `profiles.role`, validates input (3–5 questions, 2–6 options, valid answer index, length limits), and blocks admins from demoting themselves.
- **Service-role key** stays in Vercel env vars; `/api/config` returns only the public URL and anon key.
- **XSS:** all database text is HTML-escaped before rendering. A CSP header allows scripts from `self` and `esm.sh` only.
- **Password lab** never stores or transmits input, and the field is cleared when you leave the page.

> If you use a custom Supabase domain, add it to `connect-src` in `vercel.json`'s CSP.

## Testing done

- `supabase/schema.sql` executed twice on PostgreSQL 16 with a mocked `auth` schema. RLS verified: student role escalation blocked, students can't write lessons or other users' progress, admins can read all, anon denied.
- `npm test`: 14 unit tests (API auth and validation, roster math, password entropy, threat plan, HTML escaping).
- Browser end-to-end run (Chrome, stubbed Supabase client): landing, all four labs, sign-in, dashboard, checklist upsert, lesson quiz → progress upsert, glossary, admin lesson edit (PUT), role toggle (PATCH), mobile nav, sign-out. No console errors.
- **Not tested:** against a live Supabase project or a live Vercel deployment. Do a quick smoke test after deploying.

## Content accuracy notes

Lessons are general educational guidance. Facts to re-check before publishing widely, because they can change: the Philippines CICC hotline (1326), the US IC3 reference, NIST SP 800-63B password guidance, and the case-study summaries in `public/js/views/reference.js`, which are based on widely reported public accounts.
