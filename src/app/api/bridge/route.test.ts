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

describe("POST /api/bridge (persisted-verification: accepted != verified)", () => {
  const original = process.env.BRIDGE_API_SECRET;
  afterEach(() => {
    vi.unstubAllGlobals();
    original === undefined ? delete process.env.BRIDGE_API_SECRET : (process.env.BRIDGE_API_SECRET = original);
  });

  function postValid(POST: (r: NextRequest) => Promise<Response>) {
    return POST(
      new NextRequest("http://localhost/api/bridge", {
        method: "POST",
        headers: { "content-type": "application/json", "x-bridge-secret": SECRET },
        body: JSON.stringify({ type: "agents", data: { foo: "bar" } }),
      })
    );
  }

  it("persistedVerified is true only when the readback updateTime matches the write's updateTime", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: "t1" }), { status: 200 })); // PATCH
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: "t1" }), { status: 200 })); // readback
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receiverAccepted).toBe(true);
    expect(body.persistedVerified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("persistedVerified is false when the readback updateTime does not match (receiver accepted, not verified)", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: "t1" }), { status: 200 })); // PATCH
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: "t2-stale" }), { status: 200 })); // readback
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(res.status).toBe(200); // the write itself still succeeded
    expect(body.receiverAccepted).toBe(true);
    expect(body.persistedVerified).toBe(false);
    expect(body.verifyError).toBe("readback_mismatch");
  });

  it("persistedVerified is false when the readback request itself fails", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: "t1" }), { status: 200 })); // PATCH
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 })); // readback fails
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.persistedVerified).toBe(false);
    expect(body.verifyError).toBe("readback_503");
  });

  it("a failed write (non-2xx PATCH) never attempts verification and reports the write's own error status", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response("firestore down", { status: 503 })); // PATCH fails
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no readback attempted
  });
});
