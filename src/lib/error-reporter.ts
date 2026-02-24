/**
 * Lightweight client-side error reporter.
 * Logs errors to Firestore collection "error_reports" for production debugging.
 * No external dependencies. Zero-config.
 */

import { hasConfig } from "./firebase";

interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  portal?: string;
  context?: Record<string, unknown>;
}

const MAX_REPORTS_PER_SESSION = 10;
let reportCount = 0;

/** Report an error to Firestore (fire-and-forget, never throws) */
export function reportError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  if (reportCount >= MAX_REPORTS_PER_SESSION) return;
  reportCount++;

  const report: ErrorReport = {
    message: typeof error === "string" ? error : error.message,
    stack: typeof error === "string" ? undefined : error.stack?.slice(0, 500),
    url: window.location.href,
    userAgent: navigator.userAgent.slice(0, 200),
    timestamp: new Date().toISOString(),
    portal: detectPortal(),
    context,
  };

  // Log locally always
  console.error("[METTLE Error Report]", report);

  // Push to Firestore if configured
  if (hasConfig) {
    import("./firebase").then(({ fbSet }) => {
      const id = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      fbSet(`error_reports/${id}`, report as unknown as Record<string, unknown>).catch(() => {});
    });
  }
}

function detectPortal(): string {
  if (typeof window === "undefined") return "unknown";
  const path = window.location.pathname;
  if (path.includes("/athlete")) return "athlete";
  if (path.includes("/parent")) return "parent";
  if (path.includes("/coach") || path.includes("/apex-athlete")) return "coach";
  return "other";
}

/** Set up global unhandled error + rejection handlers */
export function initErrorReporting(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportError(
      reason instanceof Error ? reason : String(reason),
      { type: "unhandled_promise_rejection" }
    );
  });
}
