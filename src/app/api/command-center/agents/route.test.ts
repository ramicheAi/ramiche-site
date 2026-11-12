import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));

const { execSync, readFile } = vi.hoisted(() => ({ execSync: vi.fn(), readFile: vi.fn() }));
vi.mock("node:child_process", () => ({ execSync }));
vi.mock("child_process", () => ({ execSync }));
vi.mock("node:fs/promises", () => ({ readFile }));
vi.mock("fs/promises", () => ({ readFile }));

import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const OWNER = "the-real-owner-uid";
const req = () => new Request("http://localhost/api/command-center/agents", { headers: { cookie: "__session=" + "x".repeat(40) } });

describe("GET /api/command-center/agents — no fabricated 'active' fallback (RAMICHE-OS-CC-OVERNIGHT-RECOVERY-01)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env[OWNER_UID_ENV] = OWNER;
    verifySessionCookie.mockReset().mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    execSync.mockReset();
    readFile.mockReset().mockRejectedValue(new Error("no local directory.json")); // forces the static branch
  });
  afterEach(() => { delete process.env[OWNER_UID_ENV]; });

  it("marks NOTHING active when the 48h git-log heuristic finds no matching author (previously forced 10 agents 'active')", async () => {
    execSync.mockReturnValue("some-unrelated-human\n");
    const { GET } = await import("./route");
    const res = await (GET as (r: Request) => Promise<Response>)(req());
    const body = await res.json();
    expect(body.activeCount).toBe(0);
    expect(body.agents.every((a: { status: string }) => a.status === "idle")).toBe(true);
    expect(body.activityEvidence).toBe("git-commit-48h");
  });

  it("marks NOTHING active when git itself is unavailable, and says so explicitly — never silently fabricated", async () => {
    execSync.mockImplementation(() => { throw new Error("git: command not found"); });
    const { GET } = await import("./route");
    const res = await (GET as (r: Request) => Promise<Response>)(req());
    const body = await res.json();
    expect(body.activeCount).toBe(0);
    expect(body.activityEvidence).toBe("unavailable");
  });

  it("DOES mark an agent active when there is real matching commit-authorship evidence", async () => {
    execSync.mockReturnValue("Atlas Bot\n");
    const { GET } = await import("./route");
    const res = await (GET as (r: Request) => Promise<Response>)(req());
    const body = await res.json();
    const atlas = body.agents.find((a: { id: string }) => a.id === "atlas");
    expect(atlas?.status).toBe("active");
    expect(body.activityEvidence).toBe("git-commit-48h");
  });

  it("is still owner-only", async () => {
    verifySessionCookie.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await (GET as (r: Request) => Promise<Response>)(req());
    expect(res.status).toBe(401);
  });
});
