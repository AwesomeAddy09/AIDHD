@AGENTS.md

## Design principle: shame-free, always

This app is for people with ADHD. Guilt and failure-framing are not neutral
design choices here — they're actively counterproductive for this audience.
Apply this to every feature, not just the ones it was written for:

- No streaks, no "you missed X days," no overdue counters.
- An undone or unscheduled task is never styled with alarm/error colors
  (`TOKENS.overflow` / `overflowBg`) — reserve those for genuine errors.
  Use `TOKENS.neutralBg` / `neutralText` (or `calmBg`/`calmText`) instead.
- Copy stays neutral and forward-looking: a task "rolls to another day,"
  it doesn't "fail to fit" or go "overdue."
- Someone returning after a gap gets a plain, warm acknowledgment (see
  `checkReturningAfterGap` in `components/Dashboard.js`) — never a pileup
  of what they missed while away.
- The nightly recap prompt (`app/api/recap/route.js`) is explicitly
  instructed to be warm and non-judgmental, no guilt, no hype — keep that
  instruction intact if the prompt is ever edited.

When adding a new feature, ask: does this ever make a user feel behind,
watched, or scored? If yes, redesign it before shipping.

## Database migrations: additive only

Real users' data lives in this database. Every migration so far follows
this and it must keep being true:

- New tables: `create table if not exists`.
- New columns: `alter table ... add column if not exists ... default ...`
  (a real default, so existing rows don't end up null-by-accident).
- Never `drop table`, `drop column`, `rename column`, or change a
  column's type on a table that can hold real user data. If a field is
  genuinely obsolete, leave it in place (or stop reading/writing it in
  app code) rather than dropping it — dropping is a one-way door on data
  that isn't ours to lose.
- If a change seems to genuinely require something destructive, stop
  and ask the user first, explicitly, before writing that migration.
  Don't infer consent from "make it work."
- Add new migration snippets to `supabase/schema.sql` (it's the running
  source of truth, appended to over time) and give the user the exact
  incremental SQL to run themselves in the Supabase SQL editor — nothing
  in this app runs migrations automatically.
