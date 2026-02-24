/**
 * Lightweight performance tracker for METTLE.
 * Tracks Firestore query times, page load metrics, and user interactions.
 * Reports to Firestore collection "perf_metrics" for production monitoring.
 * Supplements Vercel Speed Insights with app-specific metrics.
 */

import { hasConfig } from "./firebase";

interface PerfMetric {
  type: "query" | "render" | "interaction" | "navigation";
  name: string;
  durationMs: number;
  timestamp: string;
  portal: string;
  metadata?: Record<string, unknown>;
}

const MAX_METRICS_PER_SESSION = 50;
let metricCount = 0;
const metricBuffer: PerfMetric[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Track a Firestore query duration */
export function trackQuery(name: string, startTime: number, metadata?: Record<string, unknown>): void {
  track("query", name, Date.now() - startTime, metadata);
}

/** Track a component render duration */
export function trackRender(name: string, startTime: number): void {
  track("render", name, Date.now() - startTime);
}

/** Track a user interaction */
export function trackInteraction(name: string, durationMs: number): void {
  track("interaction", name, durationMs);
}

function track(type: PerfMetric["type"], name: string, durationMs: number, metadata?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (metricCount >= MAX_METRICS_PER_SESSION) return;
  metricCount++;

  const metric: PerfMetric = {
    type,
    name,
    durationMs: Math.round(durationMs),
    timestamp: new Date().toISOString(),
    portal: detectPortal(),
    ...(metadata ? { metadata } : {}),
  };

  // Log locally for dev
  if (durationMs > 500) {
    console.warn(`[METTLE Perf] Slow ${type}: ${name} took ${durationMs}ms`, metadata);
  }

  metricBuffer.push(metric);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(flushMetrics, 5000); // batch flush every 5s
}

function flushMetrics(): void {
  flushTimer = null;
  if (metricBuffer.length === 0) return;
  if (!hasConfig) {
    metricBuffer.length = 0;
    return;
  }

  const batch = metricBuffer.splice(0, metricBuffer.length);

  import("./firebase").then(({ fbSet }) => {
    const id = `perf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    fbSet(`perf_metrics/${id}`, {
      metrics: batch as unknown as Record<string, unknown>[],
      sessionId: getSessionId(),
      userAgent: navigator.userAgent.slice(0, 200),
      url: window.location.href,
    } as unknown as Record<string, unknown>).catch(() => {});
  });
}

function getSessionId(): string {
  let id = sessionStorage.getItem("mettle_session_id");
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("mettle_session_id", id);
  }
  return id;
}

function detectPortal(): string {
  if (typeof window === "undefined") return "unknown";
  const path = window.location.pathname;
  if (path.includes("/athlete")) return "athlete";
  if (path.includes("/parent")) return "parent";
  return "coach";
}

/** Track Web Vitals that Vercel might miss (custom metrics) */
export function initPerfTracking(): void {
  if (typeof window === "undefined") return;

  // Track page load
  window.addEventListener("load", () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    if (nav) {
      track("navigation", "page_load", nav.loadEventEnd - nav.startTime, {
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        firstByte: Math.round(nav.responseStart - nav.startTime),
      });
    }
  });
}
