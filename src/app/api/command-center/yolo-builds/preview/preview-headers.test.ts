import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
vi.mock("node:fs", async (orig) => ({
  ...(await orig<typeof import("node:fs")>()),
  existsSync: () => true,
  readFileSync: () => Buffer.from("<script>fetch('/api/command-center/revenue')</script>"),
}));

import { GET } from "./[...path]/route";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

describe("agent-generated preview is served sandboxed", () => {
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = "the-real-owner-uid";
    verifySessionCookie.mockReset().mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
  });
  const get = () =>
    GET(new Request("http://localhost/x", { headers: { cookie: "__session=" + "x".repeat(40) } }) as never, { params: Promise.resolve({ path: ["a", "index.html"] }) });

  it("sets an opaque-origin sandbox CSP, no-store, nosniff, CORP", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/(^|;\s*)sandbox allow-scripts(;|$)/);
    expect(csp).not.toMatch(/allow-same-origin|allow-top-navigation|allow-forms|allow-popups/);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });
  it("is still owner-only", async () => {
    verifySessionCookie.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
  });
});
