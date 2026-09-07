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
  created_at timestamptz not null default now()
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

create index if not exists tasks_user_id_idx on public.tasks (user_id);
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

alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.recaps enable row level security;
alter table public.api_usage enable row level security;

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
