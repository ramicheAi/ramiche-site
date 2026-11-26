import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

import { GET, POST } from "./route";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const OWNER = "the-real-owner-uid";

function postReq(body: unknown) {
  return new Request("http://localhost/api/command-center/auth/device/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/command-center/auth/device/bootstrap", () => {
  const originalOwner = process.env[OWNER_UID_ENV];
  const originalSecret = process.env.CC_BOOTSTRAP_SECRET;
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    process.env.CC_BOOTSTRAP_SECRET = "correct-bootstrap-secret";
    getSupabaseAdmin.mockReset();
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = originalOwner;
    process.env.CC_BOOTSTRAP_SECRET = originalSecret;
  });

  function mockRpc(claim: unknown, consume: unknown) {
    const rpc = vi.fn((fn: string) => {
      if (fn === "cc_bootstrap_claim_attempt") return Promise.resolve({ data: claim, error: null });
      if (fn === "cc_bootstrap_consume_and_enroll") return Promise.resolve({ data: consume, error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    getSupabaseAdmin.mockReturnValue({ rpc });
    return rpc;
  }

  it("503s when owner isn't configured", async () => {
    delete process.env[OWNER_UID_ENV];
    const res = await POST(postReq({ token: "x" }));
    expect(res.status).toBe(503);
  });

  it("rejects a wrong token — the attempt is still counted (rate-limited guessing)", async () => {
    const rpc = mockRpc({ allowed: true, attempts: 1, locked_until: null }, null);
    const res = await POST(postReq({ token: "wrong" }));
    expect(res.status).toBe(401);
    expect(rpc).toHaveBeenCalledTimes(1); // claim only, never reaches consume/enroll
  });

  it("enrolls the first device on a correct token with zero existing devices", async () => {
    mockRpc({ allowed: true, attempts: 1, locked_until: null }, { ok: true, device_id: "11111111-1111-1111-1111-111111111111" });

    const res = await POST(postReq({ token: "correct-bootstrap-secret" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("cc_device=");
  });

  it("refuses a correct token once this owner has already consumed bootstrap — never a standing master key", async () => {
    mockRpc({ allowed: true, attempts: 1, locked_until: null }, { ok: false, device_id: null });
    const res = await POST(postReq({ token: "correct-bootstrap-secret" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("already_enrolled");
  });

  it("denies without checking the token when the attempt itself is locked", async () => {
    mockRpc({ allowed: false, attempts: 5, locked_until: new Date(Date.now() + 60_000).toISOString() }, null);
    const res = await POST(postReq({ token: "correct-bootstrap-secret" }));
    expect(res.status).toBe(429);
  });

  it("a cross-site mutation is rejected before the token is even checked", async () => {
    const res = await POST(
      new Request("http://localhost/api/command-center/auth/device/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" },
        body: JSON.stringify({ token: "correct-bootstrap-secret" }),
      })
    );
    expect(res.status).toBe(403);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});

describe("GET /api/command-center/auth/device/bootstrap", () => {
  const originalSecret = process.env.CC_BOOTSTRAP_SECRET;
  afterEach(() => {
    process.env.CC_BOOTSTRAP_SECRET = originalSecret;
  });

  it("reports ready:false with no secret configured, no secrets leaked", async () => {
    delete process.env.CC_BOOTSTRAP_SECRET;
    const res = await GET(new Request("http://localhost/api/command-center/auth/device/bootstrap"));
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(JSON.stringify(body)).not.toContain("correct-bootstrap-secret");
  });
});
