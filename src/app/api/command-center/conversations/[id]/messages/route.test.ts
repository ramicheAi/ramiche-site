import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

// Owner-only at the handler (CC-SECURITY-RECONCILIATION-02) — exercised here as
// the verified owner; authorization itself is covered by command-center-guard.test.ts.
const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
process.env.PARALLAX_OWNER_UID = "the-real-owner-uid";
const OWNER_HEADERS = { cookie: "__session=owner-session" };

const CHANNEL_ID = "11111111-1111-1111-1111-111111111111";

function req(path = `/api/command-center/conversations/${CHANNEL_ID}/messages`) {
  return new Request(`http://localhost${path}`, { headers: OWNER_HEADERS });
}
function ctx(id = CHANNEL_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/command-center/conversations/[id]/messages", () => {
  beforeEach(() => {
    verifySessionCookie.mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
    getSupabaseAdmin.mockReset();
  });

  it("an unauthenticated caller (no session cookie) is rejected before touching the database", async () => {
    const res = await GET(new Request(`http://localhost/api/command-center/conversations/${CHANNEL_ID}/messages`), ctx());
    expect(res.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("an authenticated non-owner is rejected (403), never served another identity's history", async () => {
    verifySessionCookie.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    const res = await GET(req(), ctx());
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects a malformed channel id before touching the database", async () => {
    const res = await GET(req("/api/command-center/conversations/not-a-uuid/messages"), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("503s when the service role is not configured, never a silent empty list", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    const res = await GET(req(), ctx());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("not_configured");
  });

  it("returns rows in ascending created_at order for the requested channel", async () => {
    const rows = [{ id: "m1", content: "hi" }];
    const query: Record<string, unknown> = { data: rows, error: null };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    const res = await GET(req(), ctx());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual(rows);
    expect(query.eq).toHaveBeenCalledWith("channel_id", CHANNEL_ID);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("a real DB error is reported as a failure (not an empty array) and never leaks raw secrets", async () => {
    const query: Record<string, unknown> = {
      data: null,
      error: { code: "42501", message: "permission denied for table messages, service_role_key=sb_secret_abc123" },
    };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    const res = await GET(req(), ctx());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.data).toBeUndefined();
    expect(body.error.code).toBe("42501");
    expect(body.error.message).not.toContain("sb_secret_abc123");
  });

  it("caps an oversized limit query param rather than passing it straight through", async () => {
    const query: Record<string, unknown> = { data: [], error: null };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });

    await GET(req(`/api/command-center/conversations/${CHANNEL_ID}/messages?limit=999999`), ctx());
    expect(query.limit).toHaveBeenCalledWith(200);
  });
});
