/**
 * CC-SECURITY-REMEDIATION-05 item 2: `roadmap` previously had no auth at all and a
 * wide-open CORS header (Access-Control-Allow-Origin: "*") on a handler that
 * overwrites a file on the server's filesystem with attacker-supplied JSON. Both are
 * fixed; this asserts the auth guard rejects before the filesystem is ever touched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  readFile: vi.fn(async () => "[]"),
  writeFile: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
}));

vi.mock("fs", () => ({ promises: { readFile: m.readFile, writeFile: m.writeFile, mkdir: m.mkdir } }));

import { GET, POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

function post(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/roadmap`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...headers },
    body: JSON.stringify(body),
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

beforeEach(() => {
  m.readFile.mockClear();
  m.writeFile.mockClear();
  m.mkdir.mockClear();
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /roadmap", () => {
  it("has no CORS header of its own (next.config applies the site-scoped one)", async () => {
    const res = await GET();
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("POST /roadmap", () => {
  it("is unguarded by default (no behavior change yet)", async () => {
    const res = await POST(post({ items: [] }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("401s with no session when enforced, and never touches the filesystem", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "roadmap");
    const res = await POST(post({ items: [{ evil: true }] }));
    expect(res.status).toBe(401);
    expect(m.writeFile).not.toHaveBeenCalled();
    expect(m.mkdir).not.toHaveBeenCalled();
  });

  it("401s a forged cookie, no filesystem write", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(
      post({ items: [] }, { cookie: `${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}` }),
    );
    expect(res.status).toBe(401);
    expect(m.writeFile).not.toHaveBeenCalled();
  });

  it("403s a valid session used cross-origin, no filesystem write", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(post({ items: [] }, { cookie: validCookie(), origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(m.writeFile).not.toHaveBeenCalled();
  });

  it("proceeds for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(post({ items: [{ ok: 1 }] }, { cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(m.writeFile).toHaveBeenCalled();
  });

  it("503s when enforced but the signing secret is missing (fail closed), no filesystem write", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(post({ items: [] }, { cookie: validCookie() }));
    expect(res.status).toBe(503);
    expect(m.writeFile).not.toHaveBeenCalled();
  });

  it("has no CORS header of its own", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(post({ items: [] }, { cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
