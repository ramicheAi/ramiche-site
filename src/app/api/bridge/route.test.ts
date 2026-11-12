import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie: vi.fn(async () => null) }));

const SECRET = "bridge-test-secret";

async function load() {
  vi.resetModules();
  return (await import("./route")) as { POST: (r: NextRequest) => Promise<Response> };
}
const post = (POST: (r: NextRequest) => Promise<Response>, headers: Record<string, string> = {}) =>
  POST(new NextRequest("http://localhost/api/bridge", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ type: "nope", data: {} }) }));

describe("POST /api/bridge (machine sync, secret-gated)", () => {
  const original = process.env.BRIDGE_API_SECRET;
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 }))));
  afterEach(() => {
    vi.unstubAllGlobals();
    original === undefined ? delete process.env.BRIDGE_API_SECRET : (process.env.BRIDGE_API_SECRET = original);
  });

  it("rejects missing, wrong, prefix and empty secrets", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const { POST } = await load();
    for (const h of <Array<Record<string, string>>>[{}, { "x-bridge-secret": "wrong" }, { "x-bridge-secret": SECRET.slice(0, -1) }, { "x-bridge-secret": "" }]) {
      expect((await post(POST, h)).status).toBe(401);
    }
  });

  it("fails closed when BRIDGE_API_SECRET is unset, even for an empty header", async () => {
    delete process.env.BRIDGE_API_SECRET;
    const { POST } = await load();
    expect((await post(POST, { "x-bridge-secret": "" })).status).toBe(401);
    expect((await post(POST, { "x-bridge-secret": "anything" })).status).toBe(401);
  });

  it("accepts the right secret (passes the gate)", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const { POST } = await load();
    expect((await post(POST, { "x-bridge-secret": SECRET })).status).not.toBe(401);
  });

  it("a session cookie is not a substitute for the secret", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const { POST } = await load();
    expect((await post(POST, { cookie: "__session=owner" })).status).toBe(401);
  });
});
