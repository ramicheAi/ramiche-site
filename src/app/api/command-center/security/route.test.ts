/**
 * CC-SECURITY-REMEDIATION-05 item 2: `security` (the self-audit scanner) had no
 * auth at all. It makes a live HEAD fetch against the site's own URL and runs
 * several `npm`/`git` shell commands -- both are mocked here so denied requests
 * (and even the "unguarded" baseline case) never make a real network request or
 * spawn a real process.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  execSync: vi.fn(() => ""),
  fetch: vi.fn(async () => new Response(null, { status: 200, headers: {} })),
}));

vi.mock("child_process", () => ({ execSync: m.execSync }));

import { POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

function postReq(headers: Record<string, string> = {}): Request {
  return new Request(`https://${HOST}/api/command-center/security`, {
    method: "POST",
    headers: { host: HOST, ...headers },
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = m.fetch as unknown as typeof fetch;
  m.execSync.mockClear();
  m.fetch.mockClear();
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("POST /security", () => {
  it("is unguarded by default and reaches the handler", async () => {
    const res = await POST(postReq());
    expect(res.status).not.toBe(401);
    expect(m.fetch).toHaveBeenCalled();
  });

  it("401s with no session when enforced, and never fetches or spawns a process", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "security");
    const res = await POST(postReq());
    expect(res.status).toBe(401);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.execSync).not.toHaveBeenCalled();
  });

  it("401s a forged cookie, never fetches or spawns a process", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(
      postReq({ cookie: `${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}` }),
    );
    expect(res.status).toBe(401);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("403s a valid session used cross-origin, never fetches or spawns a process", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(postReq({ cookie: validCookie(), origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it("proceeds for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(postReq({ cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(m.fetch).toHaveBeenCalled();
  });

  it("503s when enforced but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(postReq({ cookie: validCookie() }));
    expect(res.status).toBe(503);
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
