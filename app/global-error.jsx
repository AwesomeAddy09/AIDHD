"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";

// Catches rendering errors that escape every other boundary — Next.js
// replaces the whole root layout with this when it fires, which is the
// one case Sentry's normal instrumentation can't see on its own.
export default function GlobalError({ error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
