import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

describe("GET /api/command-center/pipeline/leads", () => {
  beforeEach(() => {
    const row = {
      id: "lead-1",
      name: null,
      company: "Example Co",
      product: null,
      stage: "lead",
      source: "manual",
      value: 1200,
      notes: null,
      meta: null,
    };
    const query: Record<string, unknown> = { data: [row], error: null };
    query.select = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });
  });

  it("emits the allowlisted source and distinct fresh source/response timestamps", async () => {
    const before = Date.now();
    const response = await GET(new Request("http://localhost/api/command-center/pipeline/leads?limit=300"));
    const after = Date.now();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.leads).toHaveLength(1);
    expect(body.meta.source).toBe("supabase.pipeline_leads");
    expect(Date.parse(body.meta.source_checked_at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(body.meta.source_checked_at)).toBeLessThanOrEqual(after);
    expect(Date.parse(body.meta.response_generated_at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(body.meta.response_generated_at)).toBeLessThanOrEqual(after);
    expect(Date.parse(response.headers.get("date") ?? "")).toBeGreaterThanOrEqual(before - 999);
    expect(Date.parse(response.headers.get("date") ?? "")).toBeLessThanOrEqual(after);
    expect(body.meta).not.toHaveProperty("fetched_at");
  });
});
