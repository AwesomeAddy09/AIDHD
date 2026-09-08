-- Run this once in the Supabase SQL editor for your project.
-- It creates the three tables the app needs and locks every row to its
-- owning user with row-level security, so one user's data is never
-- visible or writable by another, even via the anon key from the browser.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  category text not null default 'personal',
  minutes integer not null default 20,
  priority smallint not null default 2,
  done boolean not null default false,
  steps jsonb,
  created_at timestamptz not null default now(),
  -- Time-blindness pattern learning: started_at/actual_minutes are only
  -- set when someone uses the optional "Start" action, so they contribute
  -- a real timing data point rather than a guess. See lib/learning.js.
  started_at timestamptz,
  completed_at timestamptz,
  actual_minutes integer,
  -- Null means "whenever" (the original behavior — eligible for any day).
  -- Set means the task won't appear before this date; once it arrives it
  -- competes for that day's plan like anything else. See lib/scheduling.js.
  due_date date
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_date date not null,
  text text not null,
  start_min integer not null,
  end_min integer not null,
  created_at timestamptz not null default now(),
  -- Set true only for occurrences expanded from a recurring pattern
  -- (see expandRecurring in app/api/organize/route.js). Used purely for
  -- the day timeline's color coding, not for any recurrence logic.
  is_recurring boolean not null default false
);

create table if not exists public.recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recap_date date not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique (user_id, recap_date)
);

-- Backs a simple per-user rate limit on the Claude-calling API routes, so
-- one signed-in tester can't hammer them and run up the Anthropic bill.
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);

-- Onboarding questionnaire answers, used to personalize scheduling (day
-- boundaries derived from sleep schedule) and Claude prompt context
-- (organize/breakdown/recap). All fields nullable since every question
-- is skippable. See components/Onboarding.js and lib/scheduling.js.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekday_bedtime time,
  weekday_wake time,
  weekend_bedtime time,
  weekend_wake time,
  adhd_type smallint,
  focus_times text,
  start_difficulty text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lesson Recorder: raw audio is never written anywhere, only the
-- resulting transcript and ADHD-friendly summary, and only until the
-- user taps Discard (no auto-expiry). See components/Recorder.js.
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transcript text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

-- One-time consent notice ack for the Lesson Recorder (recording other
-- people may require their consent depending on where the user lives).
alter table public.profiles add column if not exists recorder_consent_ack_at timestamptz;

-- Reminder notifications for timed tasks/events. See lib/reminders.js.
alter table public.profiles add column if not exists reminders_enabled boolean not null default true;
alter table public.profiles add column if not exists reminder_lead_minutes smallint not null default 10;

-- Display/accessibility settings. See lib/settings.js and components/Settings.js.
alter table public.profiles add column if not exists theme text not null default 'system';
alter table public.profiles add column if not exists accent_color text not null default 'amber';
alter table public.profiles add column if not exists text_size text not null default 'medium';
alter table public.profiles add column if not exists reduce_motion boolean not null default false;
alter table public.profiles add column if not exists completion_sound_enabled boolean not null default true;
alter table public.profiles add column if not exists task_density text not null default 'comfortable';

-- Billing skeleton (see lib/stripe.js, app/api/billing/*) — everyone is
-- "free" and keeps full access regardless of plan for now. Nothing in
-- the app actually checks this column yet; it exists so the Stripe test
-- mode checkout/webhook flow has somewhere real to write its result.
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
create index if not exists profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists recordings_user_id_idx on public.recordings (user_id);
create index if not exists events_user_id_date_idx on public.events (user_id, event_date);
create index if not exists recaps_user_id_date_idx on public.recaps (user_id, recap_date);
create index if not exists api_usage_user_route_time_idx on public.api_usage (user_id, route, created_at);

-- Postgres checks these grants before row-level security is even evaluated,
-- so without them every request gets "permission denied" regardless of the
-- policies below. RLS (not these grants) is what actually keeps one user's
-- rows away from another.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.tasks to anon, authenticated;
grant select, insert, update, delete on public.events to anon, authenticated;
grant select, insert, update, delete on public.recaps to anon, authenticated;
grant select, insert on public.api_usage to anon, authenticated;
grant select, insert, update on public.profiles to anon, authenticated;
grant select, insert, delete on public.recordings to anon, authenticated;

alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.recaps enable row level security;
alter table public.api_usage enable row level security;
alter table public.profiles enable row level security;
alter table public.recordings enable row level security;

create policy "tasks: owner read" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks: owner insert" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks: owner update" on public.tasks for update using (auth.uid() = user_id);
create policy "tasks: owner delete" on public.tasks for delete using (auth.uid() = user_id);

create policy "events: owner read" on public.events for select using (auth.uid() = user_id);
create policy "events: owner insert" on public.events for insert with check (auth.uid() = user_id);
create policy "events: owner update" on public.events for update using (auth.uid() = user_id);
create policy "events: owner delete" on public.events for delete using (auth.uid() = user_id);

create policy "recaps: owner read" on public.recaps for select using (auth.uid() = user_id);
create policy "recaps: owner insert" on public.recaps for insert with check (auth.uid() = user_id);
create policy "recaps: owner update" on public.recaps for update using (auth.uid() = user_id);
create policy "recaps: owner delete" on public.recaps for delete using (auth.uid() = user_id);

create policy "api_usage: owner read" on public.api_usage for select using (auth.uid() = user_id);
create policy "api_usage: owner insert" on public.api_usage for insert with check (auth.uid() = user_id);

create policy "profiles: owner read" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles: owner insert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = user_id);

create policy "recordings: owner read" on public.recordings for select using (auth.uid() = user_id);
create policy "recordings: owner insert" on public.recordings for insert with check (auth.uid() = user_id);
create policy "recordings: owner delete" on public.recordings for delete using (auth.uid() = user_id);
