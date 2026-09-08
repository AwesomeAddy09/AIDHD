import * as Sentry from "@sentry/nextjs";

// Server + edge runtime error reporting. No-ops safely if
// NEXT_PUBLIC_SENTRY_DSN isn't set (e.g. before the Sentry project
// exists yet, or in local dev if you'd rather not report from there).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
