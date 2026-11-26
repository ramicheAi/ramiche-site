import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

import { POST } from "./route";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const OWNER = "the-real-owner-uid";

function postReq(body: unknown) {
  return new Request("http://localhost/api/command-center/auth/device/redeem", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/command-center/auth/device/redeem", () => {
  const originalOwner = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    getSupabaseAdmin.mockReset();
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = originalOwner;
  });

  it("rejects a missing code before touching the database", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("denies an invalid/expired/already-used code", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: { ok: false, issued_by_device_id: null }, error: null }));
    getSupabaseAdmin.mockReturnValue({ rpc });

    const res = await POST(postReq({ code: "whatever" }));
    expect(res.status).toBe(401);
  });

  it("enrolls a new device and sets cc_device on a valid code", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: { ok: true, issued_by_device_id: "approving-device" }, error: null }));
    const insertQ: Record<string, unknown> = { data: { id: "22222222-2222-2222-2222-222222222222" }, error: null };
    insertQ.insert = vi.fn(() => insertQ);
    insertQ.select = vi.fn(() => insertQ);
    insertQ.single = vi.fn(() => insertQ);
    getSupabaseAdmin.mockReturnValue({ rpc, from: vi.fn(() => insertQ) });

    const res = await POST(postReq({ code: "a-valid-code" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("cc_device=");
  });

  it("a cross-site mutation is rejected before the code is checked", async () => {
    const res = await POST(
      new Request("http://localhost/api/command-center/auth/device/redeem", {
        method: "POST",
        headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
        body: JSON.stringify({ code: "a-valid-code" }),
      })
    );
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("503s when owner isn't configured", async () => {
    delete process.env[OWNER_UID_ENV];
    const res = await POST(postReq({ code: "x" }));
    expect(res.status).toBe(503);
  });
});
