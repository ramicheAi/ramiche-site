import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));

import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

let GET: (req: never, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

beforeAll(async () => {
  const ws = mkdtempSync(join(tmpdir(), "cc-ws-"));
  mkdirSync(join(ws, "builds", "a"), { recursive: true });
  writeFileSync(join(ws, "builds", "a", "index.html"), "<script>fetch('/api/command-center/revenue')</script>");
  const outside = mkdtempSync(join(tmpdir(), "cc-out-"));
  writeFileSync(join(outside, "secret.txt"), "outside");
  symlinkSync(outside, join(ws, "builds", "evil"));
  process.env.OPENCLAW_WORKSPACE = ws;
  vi.resetModules();
  GET = (await import("./[...path]/route")).GET as unknown as typeof GET;
});

describe("agent-generated preview is served sandboxed and contained", () => {
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = "the-real-owner-uid";
    verifySessionCookie.mockReset().mockResolvedValue({ uid: "the-real-owner-uid", signInProvider: "password" });
  });
  const get = (...path: string[]) =>
    GET(new Request("http://localhost/x", { headers: { cookie: "__session=" + "x".repeat(40) } }) as never, { params: Promise.resolve({ path }) });

  it("sets an opaque-origin sandbox CSP, no-store, nosniff, CORP", async () => {
    const res = await get("a", "index.html");
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/(^|;\s*)sandbox allow-scripts(;|$)/);
    expect(csp).not.toMatch(/allow-same-origin|allow-top-navigation|allow-forms|allow-popups/);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });
  it("is still owner-only", async () => {
    verifySessionCookie.mockResolvedValue(null);
    expect((await get("a", "index.html")).status).toBe(401);
  });
  it("blocks traversal and symlink escape out of the builds directory", async () => {
    expect((await get("..", "x")).status).toBe(403);
    expect((await get("evil", "secret.txt")).status).toBe(403);
    expect((await get("a", "missing.html")).status).toBe(404);
  });
});
