# aidhd. — Stop thinking. Start doing.

An AI assistant for people with ADHD: dump everything on your mind, it organizes it into tasks,
breaks overwhelming ones into small steps, schedules them around your calendar, and writes a
no-guilt nightly recap.

Next.js (App Router) + Supabase (auth & database) + Claude (via a server-side API route, so the
API key never reaches the browser).

## Project layout

- `app/page.js` — server component, checks auth, renders the dashboard
- `app/login/page.js` — email/password sign in & sign up
- `app/api/organize`, `app/api/breakdown`, `app/api/recap` — server routes that call Claude
- `components/Dashboard.js` — the main UI (ported from the original prototype)
- `lib/data.js` — Supabase CRUD for tasks/events/recaps
- `lib/scheduling.js` — the day-planning algorithm (unchanged from the prototype)
- `supabase/schema.sql` — run this once in your Supabase project

## One-time setup

### 1. Supabase project

1. Go to https://supabase.com/dashboard and create a new project (pick any name/region).
2. Once it's provisioned, open **SQL Editor** and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates the `tasks`, `events`, and `recaps`
   tables with row-level security so each user can only ever see their own data.
3. Open **Authentication > Providers** and confirm **Email** is enabled (it is by default).
4. Open **Authentication > URL Configuration** and set:
   - **Site URL**: `http://localhost:3000` for now (change to your real domain after deploying)
   - **Redirect URLs**: add `http://localhost:3000/**` (and your production URL later)
5. Open **Authentication > Email Templates > Confirm signup** and change the confirmation link to:
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
   ```
   This routes the confirmation click through `app/auth/confirm/route.js` in this app instead of
   Supabase's default page. (If you'd rather skip email confirmation entirely while testing, go to
   **Authentication > Providers > Email** and turn off "Confirm email" — just remember to turn it
   back on before real users sign up.)
6. Open **Project Settings > API**. You'll need the **Project URL** and the **anon/public key**
   for `.env.local` below.

### 2. Anthropic API key

Get a key from https://console.anthropic.com/settings/keys. This key only ever lives on the
server (`.env.local`, and your host's environment variables in production) — it's never sent to
the browser.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase step 6 above
- `ANTHROPIC_API_KEY` from the Anthropic console

Don't paste these into chat — just edit the file directly. `.env.local` is gitignored.

### 4. Run it

```bash
npm install
npm run dev
```

Visit http://localhost:3000, create an account, and confirm the email (or disable email
confirmation as noted above for quicker local testing).

## Deploying

The easiest path is [Vercel](https://vercel.com) (made by the Next.js team):

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the same three environment variables from `.env.local` in the Vercel project settings.
4. Deploy, then go back to Supabase's **Authentication > URL Configuration** and add your Vercel
   URL to **Site URL** and **Redirect URLs**.

Any other Node host works too, as long as it can run `next build` / `next start` and you set the
same environment variables there.
