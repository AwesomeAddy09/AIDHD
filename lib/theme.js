// Every value here is a CSS custom property, not a literal color — the
// actual light/dark and accent-preset values live in app/globals.css,
// switched by data-theme/data-accent attributes on <html> (see
// lib/settings.js). That means every component that already does
// style={{ background: TOKENS.bg }} gets live theme switching for free,
// without needing to touch each component individually.
export const TOKENS = {
  bg: "var(--bg)",
  card: "var(--card)",
  ink: "var(--ink)",
  sub: "var(--sub)",
  border: "var(--border)",
  now: "var(--now)",
  nowBg: "var(--now-bg)",
  nowText: "var(--now-text)",
  calm: "var(--calm)",
  calmBg: "var(--calm-bg)",
  calmText: "var(--calm-text)",
  overflow: "var(--overflow)",
  overflowBg: "var(--overflow-bg)",
  // Reserved for genuine errors only (see CLAUDE.md's shame-free design
  // principle) — never for a task that simply didn't fit today.
  neutralBg: "var(--neutral-bg)",
  neutralText: "var(--neutral-text)",
  // Third color for the day timeline: recurring events use `now`
  // (orange), scheduled tasks use `calm` (green), one-off fixed-time
  // events use this dusty blue.
  event: "var(--event)",
  eventBg: "var(--event-bg)",
  eventText: "var(--event-text)",
};
