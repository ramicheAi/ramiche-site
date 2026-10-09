import { describe, expect, it, vi } from "vitest";
import { fetchLiveLeads } from "./leads-loader";

const response = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
}));

describe("fetchLiveLeads", () => {
  it("distinguishes a verified live zero from unavailable data", async () => {
    const result = await fetchLiveLeads(vi.fn(() => response(200, {
      leads: [],
      meta: { source: "supabase.pipeline_leads", fetched_at: "2026-10-09T19:00:00.000Z" },
    })));

    expect(result).toEqual({
      ok: true,
      leads: [],
      source: "supabase.pipeline_leads",
      fetchedAt: "2026-10-09T19:00:00.000Z",
    });
  });

  it("fails visibly on non-OK HTTP responses", async () => {
    const result = await fetchLiveLeads(vi.fn(() => response(503, { error: "not configured" })));
    expect(result).toEqual({ ok: false, message: "Live CRM unavailable (HTTP 503)." });
  });

  it("fails visibly when a successful response lacks provenance", async () => {
    const result = await fetchLiveLeads(vi.fn(() => response(200, { leads: [] })));
    expect(result).toEqual({ ok: false, message: "Live CRM response is missing provenance." });
  });

  it("fails visibly on network or JSON errors", async () => {
    const network = await fetchLiveLeads(vi.fn(() => Promise.reject(new Error("offline"))));
    const malformed = await fetchLiveLeads(vi.fn(() => Promise.resolve(new Response("not json", { status: 200 }))));
    expect(network).toEqual({ ok: false, message: "Live CRM unavailable (network or response error)." });
    expect(malformed).toEqual({ ok: false, message: "Live CRM unavailable (network or response error)." });
  });
});
