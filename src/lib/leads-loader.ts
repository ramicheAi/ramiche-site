export type LiveLeadsResult<T> =
  | { ok: true; leads: T[]; source: string; fetchedAt: string }
  | { ok: false; message: string };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Loads the live CRM and distinguishes verified zero rows from source failure.
 * The UI must only render an empty state for an `ok: true` result.
 */
export async function fetchLiveLeads<T>(fetcher: FetchLike): Promise<LiveLeadsResult<T>> {
  try {
    const res = await fetcher("/api/command-center/pipeline/leads?limit=300", { cache: "no-store" });
    if (!res.ok) return { ok: false, message: `Live CRM unavailable (HTTP ${res.status}).` };

    const body: unknown = await res.json();
    if (!body || typeof body !== "object" || !Array.isArray((body as { leads?: unknown }).leads)) {
      return { ok: false, message: "Live CRM returned an invalid response." };
    }

    const meta = (body as { meta?: unknown }).meta;
    if (!meta || typeof meta !== "object") {
      return { ok: false, message: "Live CRM response is missing provenance." };
    }

    const { source, fetched_at } = meta as { source?: unknown; fetched_at?: unknown };
    if (typeof source !== "string" || typeof fetched_at !== "string") {
      return { ok: false, message: "Live CRM response is missing provenance." };
    }

    return { ok: true, leads: (body as { leads: T[] }).leads, source, fetchedAt: fetched_at };
  } catch {
    return { ok: false, message: "Live CRM unavailable (network or response error)." };
  }
}
