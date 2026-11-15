import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
process.env.PARALLAX_OWNER_UID = "the-real-owner-uid";
const OWNER_HEADERS = { cookie: "__session=owner-session" };

function req() {
  return new Request("http://localhost/api/command-center/channels", { headers: OWNER_HEADERS });
}

// GET_handler takes no args; ownerOnly's generic erases that to the wrapped
// handler's own signature, so TS sees GET as a 0-arg function (same pattern
// as agents/route.test.ts in PR #84).
const GET_ = GET as (r: Request) => Promise<Response>;

describe("GET /api/command-center/channels", () => {
  beforeEach(() => {
    verifySessionCookie.mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
    getSupabaseAdmin.mockReset();
  });

  it("an unauthenticated caller is rejected before touching the database", async () => {
    const res = await GET_(new Request("http://localhost/api/command-center/channels"));
    expect(res.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("an authenticated non-owner is rejected (403)", async () => {
    verifySessionCookie.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    const res = await GET_(req());
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("503s when the service role is not configured", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    const res = await GET_(req());
    expect(res.status).toBe(503);
  });

  it("returns the channel rows ordered by last activity", async () => {
    const rows = [{ id: "c1", slug: "general" }];
    const query: Record<string, unknown> = { data: rows, error: null };
    query.select = vi.fn(() => query);
    query.order = vi.fn(() => query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    const res = await GET_(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual(rows);
    expect(query.order).toHaveBeenCalledWith("last_activity_at", { ascending: false });
  });

  it("a DB error is reported as a failure, never an empty list", async () => {
    const query: Record<string, unknown> = { data: null, error: { code: "42501", message: "permission denied" } };
    query.select = vi.fn(() => query);
    query.order = vi.fn(() => query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    const res = await GET_(req());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.data).toBeUndefined();
    expect(body.error.code).toBe("42501");
  });
});
