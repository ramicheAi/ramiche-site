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

  // Real Firestore updateTime shape: RFC3339 UTC, fixed-width fractional
  // seconds, always "Z" — sorts correctly as a plain string.
  const T1 = "2026-11-12T10:00:00.000000Z";
  const T0_EARLIER = "2026-11-12T09:59:59.000000Z";
  const T2_LATER = "2026-11-12T10:00:01.000000Z";

  it("persistedVerified is true when the readback updateTime exactly matches the write's updateTime", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T1 }), { status: 200 })); // PATCH
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T1 }), { status: 200 })); // readback
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receiverAccepted).toBe(true);
    expect(body.persistedVerified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("persistedVerified is true when the readback updateTime is NEWER than the write's (a concurrent writer bumped it again)", async () => {
    // This is the fix for the independent-review finding: a shared
    // collection like `tasks` that the Command Center UI can also write
    // used to flap "unverified" on every concurrent edit, because an exact
    // match was required. A later write still proves THIS write persisted.
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T1 }), { status: 200 })); // PATCH
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T2_LATER }), { status: 200 })); // readback, newer
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(body.persistedVerified).toBe(true);
    expect(body.verifyError).toBeUndefined();
  });

  it("persistedVerified is false when the readback updateTime is OLDER than the write's (a genuinely stale read)", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T1 }), { status: 200 })); // PATCH
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T0_EARLIER }), { status: 200 })); // readback, older
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(res.status).toBe(200); // the write itself still succeeded
    expect(body.receiverAccepted).toBe(true);
    expect(body.persistedVerified).toBe(false);
    expect(body.verifyError).toBe("readback_mismatch");
  });

  it("persistedVerified is false, with a distinct error, when the write response carries no updateTime", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 })); // PATCH, no updateTime
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(body.persistedVerified).toBe(false);
    expect(body.verifyError).toBe("no_update_time");
    expect(fetchMock).toHaveBeenCalledTimes(1); // no readback attempted without something to compare against
  });

  it("persistedVerified is false when the readback request itself fails", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T1 }), { status: 200 })); // PATCH
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 })); // readback fails
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.persistedVerified).toBe(false);
    expect(body.verifyError).toBe("readback_503");
  });

  it("a readback exception never leaks raw error text into the response, only a fixed code", async () => {
    process.env.BRIDGE_API_SECRET = SECRET;
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updateTime: T1 }), { status: 200 })); // PATCH
    fetchMock.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.1:443 internal-detail")); // readback throws
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await load();
    const res = await postValid(POST);
    const body = await res.json();
    expect(body.persistedVerified).toBe(false);
    expect(body.verifyError).toBe("readback_exception");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("internal-detail");
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
