# Sending Supabase Auth emails through Resend

Supabase's built-in email sender is for testing only: it sends a handful of emails per hour and only to project team members. To deliver sign-up confirmations, password resets, and magic links to real users, connect Resend as a custom SMTP server.

**The Resend API key lives only in the Supabase Dashboard.** The app never sends email itself, so the key does **not** go into Vercel, `.env.local`, or this repository.

## 1. Set up Resend

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add Domain.** Use a domain you control, ideally a subdomain such as `mail.yourdomain.com`.
3. Add the DNS records Resend shows you (an SPF `TXT`/`MX` pair and a DKIM `TXT` record) at your DNS provider, then click **Verify**. Wait until the domain shows **Verified**.
   - Optional but recommended: add a DMARC record, for example `_dmarc.yourdomain.com TXT "v=DMARC1; p=none;"`.
4. **API Keys → Create API Key.**
   - Name: `supabase-auth`
   - Permission: **Sending access**
   - Domain: the domain you just verified
   - Copy the key (it starts with `re_`). You can only see it once.

## 2. Enter the SMTP settings in Supabase

Supabase Dashboard → your project → **Authentication → Emails → SMTP Settings** (older dashboards: **Project Settings → Authentication → SMTP Settings**). Turn on **Enable custom SMTP** and enter:

| Field | Value |
|---|---|
| Sender email | `no-reply@mail.yourdomain.com` (must be on the verified domain) |
| Sender name | `OpSec for Dummies` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_...`) |
| Minimum interval between emails | leave the default (60 seconds) |

Click **Save**.

Port 465 uses implicit TLS. If your network blocks it, Resend also accepts `587` (STARTTLS) with the same username and password.

> Resend also has a one-click Supabase integration (Resend → **Integrations → Supabase**) that fills in these same fields for you.

## 3. Raise the email rate limit

Custom SMTP starts with a low limit. Go to **Authentication → Rate Limits** and set **Rate limit for sending emails** to something that fits your sign-up volume (for example 100 per hour). Stay within your Resend plan's sending limits.

## 4. Set the redirect URLs

The app sends users back to these URLs from email links. Go to **Authentication → URL Configuration**:

- **Site URL:** your production URL, e.g. `https://your-app.vercel.app`
- **Redirect URLs** (add each one):
  - `https://your-app.vercel.app/**`
  - `https://*-your-team.vercel.app/**` (Vercel preview deployments, optional)
  - `http://localhost:3000/**` (local `vercel dev`)

The app uses:

| Email | Redirect the app requests | What happens |
|---|---|---|
| Sign-up confirmation | `https://your-app/` | Signs the user in; new users land on the Security Checklist baseline. |
| Magic link | `https://your-app/` | Signs the user in (existing accounts only). |
| Password reset | `https://your-app/?auth=recovery` | Opens the "Choose a new password" form. |

If a redirect isn't on the allow list, Supabase falls back to the Site URL and the reset form won't open, so make sure the wildcard entries are there.

## 5. Check the email templates (optional)

**Authentication → Emails → Templates.** The defaults work. If you edit them, keep `{{ .ConfirmationURL }}` as the link. You can rename the subjects, for example "Confirm your OpSec for Dummies account" and "Reset your OpSec for Dummies password".

## 6. Test it

1. Sign up with a real address you can read. The email should arrive from your Resend sender within a minute.
2. Resend → **Emails** shows each message and its delivery status.
3. Log out, choose **Forgot password?**, and follow the link. You should see the new-password form.
4. Choose **Email me a sign-in link instead** on the log-in page and follow that link.

If emails don't arrive: check Supabase → **Logs → Auth** for SMTP errors, confirm the sender address is on the verified domain, and confirm the API key has sending access to that domain.

## Environment variables

No new variables are needed. Vercel still only needs:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
