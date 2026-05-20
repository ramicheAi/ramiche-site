import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,

    // Strip secrets that occasionally appear in URLs + any auto-captured
    // user.email. Mirrors the scrubber in sentry.server.config.ts.
    beforeSend(event) {
      try {
        if (event.request?.url) {
          const url = new URL(event.request.url);
          for (const k of ["pin", "token", "email", "code", "verification", "key", "secret"]) {
            if (url.searchParams.has(k)) url.searchParams.set(k, "[redacted]");
          }
          event.request.url = url.toString();
        }
        if (event.user?.email) event.user.email = "[redacted]";
      } catch {
        /* defensive — never let a scrubber bug eat the report */
      }
      return event;
    },

    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      "AbortError: The user aborted a request.",
      "TypeError: Failed to fetch",
      "TypeError: NetworkError",
      "Permission denied to access property 'document'",
    ],

    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
