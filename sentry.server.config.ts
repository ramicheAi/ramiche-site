import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,

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
        if (event.request?.headers) {
          for (const h of Object.keys(event.request.headers)) {
            if (h.toLowerCase() === "authorization" || h.toLowerCase() === "cookie") {
              event.request.headers[h] = "[redacted]";
            }
          }
        }
      } catch {
        /* never let scrubbing eat the report */
      }
      return event;
    },

    ignoreErrors: ["AbortError"],
  });
}
