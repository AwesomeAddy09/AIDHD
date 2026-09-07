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
