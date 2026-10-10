export const LIVE_LEADS_SOURCE = "supabase.pipeline_leads";
export const LIVE_LEADS_TIMEOUT_MS = 10_000;
export const LIVE_LEADS_MAX_AGE_MS = 5 * 60_000;

export interface LeadRecommendation {
  items: Array<{ id: string; name: string; billing: "one-time" | "monthly"; price: number; value: string }>;
  oneTimeTotal: number;
  monthlyTotal: number;
  rationale: string[];
}

export interface LiveLead {
  id: string;
  name: string | null;
  company: string | null;
  product: string | null;
  stage: "lead" | "qualified" | "proposal" | "negotiation" | "closed" | "lost";
  source: string | null;
  value: number;
  notes: string | null;
  meta: {
    website?: string | null;
    audit?: { healthScore?: number; gaps?: string[] };
    recommendation?: LeadRecommendation | null;
    fit?: { fitScore?: number; qualified?: boolean };
    disqualified?: boolean;
  } | null;
}

export type LiveLeadsResult =
  | { ok: true; leads: LiveLead[]; source: typeof LIVE_LEADS_SOURCE; sourceCheckedAt: string; responseGeneratedAt: string }
  | { ok: false; reason: "aborted" | "http" | "invalid" | "network" | "timeout"; message: string };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface FetchLiveLeadsOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxAgeMs?: number;
}

const STAGES = new Set<LiveLead["stage"]>(["lead", "qualified", "proposal", "negotiation", "closed", "lost"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isRecommendation(value: unknown): value is LeadRecommendation {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.rationale)) return false;
  if (!Number.isFinite(value.oneTimeTotal) || !Number.isFinite(value.monthlyTotal)) return false;
  if (!value.rationale.every((item) => typeof item === "string")) return false;
  return value.items.every((item) => isRecord(item)
    && typeof item.id === "string"
    && typeof item.name === "string"
    && (item.billing === "one-time" || item.billing === "monthly")
    && typeof item.price === "number" && Number.isFinite(item.price)
    && typeof item.value === "string");
}

function isLeadMeta(value: unknown): value is LiveLead["meta"] {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  if (value.website !== undefined && !isNullableString(value.website)) return false;
  if (value.disqualified !== undefined && typeof value.disqualified !== "boolean") return false;
  if (value.audit !== undefined) {
    if (!isRecord(value.audit) || !isOptionalNumber(value.audit.healthScore)) return false;
    if (value.audit.gaps !== undefined && (!Array.isArray(value.audit.gaps) || !value.audit.gaps.every((gap) => typeof gap === "string"))) return false;
  }
  if (value.fit !== undefined) {
    if (!isRecord(value.fit) || !isOptionalNumber(value.fit.fitScore)) return false;
    if (value.fit.qualified !== undefined && typeof value.fit.qualified !== "boolean") return false;
  }
  return value.recommendation === undefined || value.recommendation === null || isRecommendation(value.recommendation);
}

export function isLiveLead(value: unknown): value is LiveLead {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0
    && isNullableString(value.name)
    && isNullableString(value.company)
    && isNullableString(value.product)
    && typeof value.stage === "string" && STAGES.has(value.stage as LiveLead["stage"])
    && isNullableString(value.source)
    && typeof value.value === "number" && Number.isFinite(value.value)
    && isNullableString(value.notes)
    && isLeadMeta(value.meta);
}

function validTimestamp(value: unknown, now: number, maxAgeMs: number): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + 5_000 && timestamp >= now - maxAgeMs;
}

/** Loads live CRM data. Only fully validated, fresh responses can be marked verified. */
export async function fetchLiveLeads(fetcher: FetchLike, options: FetchLiveLeadsOptions = {}): Promise<LiveLeadsResult> {
  const { signal, timeoutMs = LIVE_LEADS_TIMEOUT_MS, maxAgeMs = LIVE_LEADS_MAX_AGE_MS } = options;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Live CRM request timed out", "TimeoutError"));
  }, timeoutMs);

  try {
    const res = await fetcher("/api/command-center/pipeline/leads?limit=300", { cache: "no-store", signal: controller.signal });
    if (!res.ok) return { ok: false, reason: "http", message: `Live CRM unavailable (HTTP ${res.status}).` };

    const body: unknown = await res.json();
    if (!isRecord(body) || !Array.isArray(body.leads)) {
      return { ok: false, reason: "invalid", message: "Live CRM returned an invalid response." };
    }
    if (!body.leads.every(isLiveLead)) {
      return { ok: false, reason: "invalid", message: "Live CRM returned malformed lead data." };
    }

    const meta = body.meta;
    if (!isRecord(meta)) {
      return { ok: false, reason: "invalid", message: "Live CRM response is missing provenance." };
    }
    const serverTime = Date.parse(res.headers.get("date") ?? "");
    if (meta.source !== LIVE_LEADS_SOURCE) {
      return { ok: false, reason: "invalid", message: "Live CRM response has an untrusted source." };
    }
    if (!Number.isFinite(serverTime)
      || !validTimestamp(meta.source_checked_at, serverTime, maxAgeMs)
      || !validTimestamp(meta.response_generated_at, serverTime, maxAgeMs)) {
      return { ok: false, reason: "invalid", message: "Live CRM provenance is invalid or stale." };
    }
    if (Date.parse(meta.source_checked_at) > Date.parse(meta.response_generated_at) + 5_000) {
      return { ok: false, reason: "invalid", message: "Live CRM provenance is invalid or stale." };
    }

    return {
      ok: true,
      leads: body.leads,
      source: LIVE_LEADS_SOURCE,
      sourceCheckedAt: meta.source_checked_at,
      responseGeneratedAt: meta.response_generated_at,
    };
  } catch {
    if (timedOut) return { ok: false, reason: "timeout", message: "Live CRM request timed out." };
    if (controller.signal.aborted) return { ok: false, reason: "aborted", message: "Live CRM request was cancelled." };
    return { ok: false, reason: "network", message: "Live CRM unavailable (network or response error)." };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
