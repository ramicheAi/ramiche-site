import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLiveLeads, type LiveLead } from "./leads-loader";

const NOW = Date.parse("2026-10-09T20:00:00.000Z");
const NOW_ISO = new Date(NOW).toISOString();
const response = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
}));
const validLead: LiveLead = {
  id: "lead-1",
  name: "Avery",
  company: "Example Co",
  product: "Lead Recovery",
  stage: "qualified",
  source: "manual",
  value: 5000,
  notes: null,
  meta: { fit: { fitScore: 82, qualified: true } },
};
const payload = (leads: unknown[] = []) => ({
  leads,
  meta: {
    source: "supabase.pipeline_leads",
    source_checked_at: NOW_ISO,
    response_generated_at: NOW_ISO,
  },
});
const options = { now: () => NOW };

afterEach(() => vi.useRealTimers());

describe("fetchLiveLeads", () => {
  it("distinguishes verified empty and verified data responses", async () => {
    const empty = await fetchLiveLeads(vi.fn(() => response(200, payload())), options);
    const populated = await fetchLiveLeads(vi.fn(() => response(200, payload([validLead]))), options);

    expect(empty).toMatchObject({ ok: true, leads: [], sourceCheckedAt: NOW_ISO });
    expect(populated).toMatchObject({ ok: true, leads: [validLead], sourceCheckedAt: NOW_ISO });
  });

  it("fails visibly on non-OK HTTP and network responses", async () => {
    const http = await fetchLiveLeads(vi.fn(() => response(503, { error: "not configured" })), options);
    const network = await fetchLiveLeads(vi.fn(() => Promise.reject(new Error("offline"))), options);

    expect(http).toEqual({ ok: false, reason: "http", message: "Live CRM unavailable (HTTP 503)." });
    expect(network).toEqual({ ok: false, reason: "network", message: "Live CRM unavailable (network or response error)." });
  });

  it("rejects missing, arbitrary, invalid, and stale provenance", async () => {
    const missing = await fetchLiveLeads(vi.fn(() => response(200, { leads: [] })), options);
    const arbitrary = await fetchLiveLeads(vi.fn(() => response(200, {
      ...payload(), meta: { ...payload().meta, source: "anything" },
    })), options);
    const invalid = await fetchLiveLeads(vi.fn(() => response(200, {
      ...payload(), meta: { ...payload().meta, source_checked_at: "yesterday" },
    })), options);
    const stale = await fetchLiveLeads(vi.fn(() => response(200, {
      ...payload(),
      meta: {
        ...payload().meta,
        source_checked_at: "2026-10-09T19:54:59.999Z",
        response_generated_at: "2026-10-09T19:54:59.999Z",
      },
    })), options);

    expect(missing).toMatchObject({ ok: false, reason: "invalid", message: "Live CRM response is missing provenance." });
    expect(arbitrary).toMatchObject({ ok: false, reason: "invalid", message: "Live CRM response has an untrusted source." });
    expect(invalid).toMatchObject({ ok: false, reason: "invalid", message: "Live CRM provenance is invalid or stale." });
    expect(stale).toMatchObject({ ok: false, reason: "invalid", message: "Live CRM provenance is invalid or stale." });
  });

  it("rejects malformed lead rows before they reach the UI", async () => {
    const result = await fetchLiveLeads(vi.fn(() => response(200, payload([{ ...validLead, value: "5000" }]))), options);
    expect(result).toEqual({ ok: false, reason: "invalid", message: "Live CRM returned malformed lead data." });
  });

  it("accepts the intentional null recommendation shape for disqualified leads", async () => {
    const disqualified = {
      ...validLead,
      stage: "lost",
      value: 0,
      meta: { recommendation: null, disqualified: true },
    };
    const result = await fetchLiveLeads(vi.fn(() => response(200, payload([disqualified]))), options);
    expect(result).toMatchObject({ ok: true, leads: [disqualified] });
  });

  it("fails visibly on malformed JSON", async () => {
    const result = await fetchLiveLeads(vi.fn(() => Promise.resolve(new Response("not json", { status: 200 }))), options);
    expect(result).toEqual({ ok: false, reason: "network", message: "Live CRM unavailable (network or response error)." });
  });

  it("times out and aborts a stalled request", async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        receivedSignal?.addEventListener("abort", () => reject(receivedSignal?.reason));
      });
    });

    const pending = fetchLiveLeads(fetcher, { ...options, timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toEqual({ ok: false, reason: "timeout", message: "Live CRM request timed out." });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("propagates caller cancellation distinctly from timeout", async () => {
    const caller = new AbortController();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const pending = fetchLiveLeads(fetcher, { ...options, signal: caller.signal });
    caller.abort();
    await expect(pending).resolves.toEqual({ ok: false, reason: "aborted", message: "Live CRM request was cancelled." });
  });
});
