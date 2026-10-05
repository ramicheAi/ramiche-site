/**
 * P06 M5: the Universal Command routes through the REAL owner guards. Only the founder session reaches the router;
 * every fleet credential, with any claimed agent identity, is denied and nothing is written. Stores are in-memory.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueCsrfToken } from "@/lib/server/csrf";
import { __setMissionStoreForTests } from "@/lib/missions/http";
import type { MissionStore } from "@/lib/missions/store";
import { __setCommandStoreForTests } from "./http";
import type { CommandRow, CommandStore } from "./store";

const { sessionVerifier, spies } = vi.hoisted(() => ({ sessionVerifier: vi.fn(), spies: { exec: vi.fn(), runJob: vi.fn(), record: vi.fn() } }));
vi.mock("@/lib/firebase-admin", async (orig) => ({ ...(await orig<object>()), verifySessionCookie: sessionVerifier }));
vi.mock("@/lib/provider-adapter", () => ({ executeCompletion: spies.exec, streamCompletion: spies.exec, executeOpenClaw: spies.exec }));
vi.mock("@/lib/jobs", () => ({ runJob: spies.runJob }));
vi.mock("@/lib/execution-events", () => ({ recordExecution: spies.record }));

const OWNER = "owner_fixture_only";
const COOKIE = "fixture-session-".repeat(5);
const ORIGIN = "https://cockpit.example";
const FLEET: Record<string, [string, string, string]> = {
  "openclaw-webhook": ["OPENCLAW_CC_WEBHOOK_TOKEN", "authorization", "Bearer fixture-openclaw-bearer-0123456789"],
  push: ["CC_PUSH_SECRET", "x-cc-push-secret", "fixture-push-svc-xxxxxxxxxxxxxxxx"],
  bridge: ["BRIDGE_API_SECRET", "x-bridge-secret", "fixture-bridge-secret-0123456789"],
  cron: ["PARALLAX_CRON_TOKEN", "authorization", "Bearer fixture-cron-bearer-0123456789"],
  vapi: ["PARALLAX_VAPI_WEBHOOK_SECRET", "x-vapi-secret", "fixture-vapi-secret-0123456789"],
  "missions-token": ["PARALLAX_MISSIONS_AGENT_TOKEN", "x-parallax-missions-token", "fixture-missions-token-0123456789"],
};
const AGENT_NAMES = ["triage", "atlas", "nova", null] as const;

const rows: CommandRow[] = [];
const store: CommandStore = {
  commandChannel: async () => ({ ok: true, data: "c0000000-0000-4000-8000-0000000000cc" }),
  insertCommand: async (a) => { const r = { id: `9e000000-0000-4000-8000-${String(rows.length + 1).padStart(12, "0")}`, channel_id: a.channelId, content: a.content, metadata: a.metadata, created_at: "" }; rows.push(r); return { ok: true, data: r }; },
  getCommand: async (_t, id) => ({ ok: true, data: rows.find((r) => r.id === id) ?? null }),
  linkedMissions: async () => ({ ok: true, data: [] }),
};
const missions = { getMission: async () => ({ ok: true, data: null }) } as unknown as MissionStore;

beforeAll(() => { __setCommandStoreForTests(store); __setMissionStoreForTests(missions); });
afterAll(() => { __setCommandStoreForTests(null); __setMissionStoreForTests(null); });
beforeEach(() => {
  vi.stubEnv("PARALLAX_OWNER_UID", OWNER);
  vi.stubEnv("PARALLAX_TRUSTED_ORIGINS", ORIGIN);
  vi.stubEnv("PARALLAX_CSRF_SECRET", "fixture-not-a-real-secret-".repeat(3));
  for (const [env, , value] of Object.values(FLEET)) vi.stubEnv(env, value.replace(/^Bearer /, ""));
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const founderHeaders = (): Record<string, string> => {
  const t = issueCsrfToken(COOKIE);
  return { origin: ORIGIN, "content-type": "application/json", cookie: `__session=${COOKIE}`, ...(t.ok ? { "x-parallax-csrf": t.token } : {}) };
};
async function call(mod: string, method: string, path: string, headers: Record<string, string>, body?: unknown, params: Record<string, string> = {}) {
  const m = await import(`@/app/api/command-center/command/shadow${mod}/route`);
  const req = new NextRequest(`${ORIGIN}/api/command-center/command/shadow${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const res: Response = await m[method](req, { params: Promise.resolve(params) });
  return { status: res.status, json: await res.json(), cache: res.headers.get("cache-control") };
}

describe("Universal Command routes", () => {
  it("only a real owner-guard success maps to the founder context", async () => {
    const { commandContext } = await import("./http");
    for (const bad of [{ ok: true, uid: "" }, { ok: false, uid: OWNER }, null, { ok: true }] as unknown as { ok: true; uid: string }[]) {
      const c = commandContext(bad);
      expect(c.ok).toBe(false);
      if (!c.ok) expect(c.response.status).toBe(403);
    }
    expect(commandContext({ ok: true, uid: OWNER }).ok).toBe(true);
  });

  it("the founder records a shadow decision and reads it back; nothing executes", async () => {
    const r = await call("", "POST", "", founderHeaders(), { text: "Claude Code, fix Mettle. Codex reviews. Don't merge without me." });
    expect([r.status, r.cache, r.json.data.executed, r.json.data.decision.handler]).toEqual([201, "no-store", false, "claude_code"]);
    const g = await call("/[id]", "GET", `/${r.json.data.id}`, founderHeaders(), undefined, { id: r.json.data.id });
    expect([g.status, g.json.data.id, g.json.data.shadow]).toEqual([200, r.json.data.id, true]);
    for (const s of Object.values(spies)) expect(s).not.toHaveBeenCalled();
  });

  it("a machine caller with any valid fleet credential and any claimed agent gets no founder authority, and nothing is written", async () => {
    const before = rows.length;
    const target = rows[0]?.id ?? "9e000000-0000-4000-8000-000000000001";
    for (const cred of Object.keys(FLEET)) {
      for (const agent of AGENT_NAMES) {
        const [, header, value] = FLEET[cred];
        const h = { "content-type": "application/json", [header]: value, ...(agent ? { "x-parallax-agent": agent } : {}), "x-ramon-uid": OWNER };
        const p = await call("", "POST", "", h, { text: "Claude Code, fix Mettle" });
        const g = await call("/[id]", "GET", `/${target}`, h, undefined, { id: target });
        for (const r of [p, g]) {
          expect([401, 403], `${cred} as ${agent}`).toContain(r.status);
          expect(r.json).toMatchObject({ error: "denied" });
          expect(r.cache).toBe("no-store");
        }
      }
    }
    expect(rows.length).toBe(before);
    for (const s of Object.values(spies)) expect(s).not.toHaveBeenCalled();
  });

  it("a non-owner session, a missing CSRF token or a foreign origin is denied", async () => {
    const before = rows.length;
    sessionVerifier.mockResolvedValue({ uid: "someone_else", signInProvider: "password" });
    expect((await call("", "POST", "", founderHeaders(), { text: "fix it" })).status).toBe(403);
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    const noCsrf = founderHeaders(); delete noCsrf["x-parallax-csrf"];
    expect((await call("", "POST", "", noCsrf, { text: "fix it" })).status).toBe(403);
    expect((await call("", "POST", "", { ...founderHeaders(), origin: "https://evil.example" }, { text: "fix it" })).status).toBe(403);
    expect(rows.length).toBe(before);
  });
});
