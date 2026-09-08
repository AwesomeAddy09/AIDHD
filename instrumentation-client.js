import * as Sentry from "@sentry/nextjs";

// Client-side error reporting. Session Replay is deliberately left off
// (sample rates at 0, integration not added) — this app handles personal
// content (task text, sleep schedules, Lesson Recorder transcripts) that
// has no business being captured in a screen recording attached to an
// error report. See app/privacy/page.js.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
