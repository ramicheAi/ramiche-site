/**
 * Heartbeat health metrics for agent performance monitoring (ByteByteGo #29).
 * Tracks response times, error rates, and uptime per agent/service.
 */

interface MetricWindow {
  requests: number;
  errors: number;
  totalResponseMs: number;
  lastActivity: number;
}

const WINDOW_SIZE_MS = 5 * 60 * 1000; // 5-minute windows
const metrics = new Map<string, MetricWindow>();

function getOrCreate(service: string): MetricWindow {
  if (!metrics.has(service)) {
    metrics.set(service, { requests: 0, errors: 0, totalResponseMs: 0, lastActivity: Date.now() });
  }
  return metrics.get(service)!;
}

export function recordRequest(service: string, responseMs: number, isError = false) {
  const m = getOrCreate(service);
  m.requests++;
  m.totalResponseMs += responseMs;
  m.lastActivity = Date.now();
  if (isError) m.errors++;
}

export function getHealthMetrics(service: string) {
  const m = metrics.get(service);
  if (!m || m.requests === 0) {
    return { status: "idle", requests: 0, errorRate: 0, avgResponseMs: 0, lastActivity: null };
  }
  const errorRate = m.errors / m.requests;
  const avgResponseMs = Math.round(m.totalResponseMs / m.requests);
  const status = errorRate > 0.5 ? "degraded" : errorRate > 0.1 ? "warning" : "healthy";
  return { status, requests: m.requests, errorRate: Math.round(errorRate * 100), avgResponseMs, lastActivity: m.lastActivity };
}

export function getAllHealthMetrics() {
  const result: Record<string, ReturnType<typeof getHealthMetrics>> = {};
  for (const [service] of metrics) {
    result[service] = getHealthMetrics(service);
  }
  return result;
}

export function resetMetrics(service?: string) {
  if (service) metrics.delete(service);
  else metrics.clear();
}
