/**
 * Command Center and METTLE share the `__session` cookie. This drives all three
 * endpoints through ONE simulated browser cookie jar and checks login, logout,
 * expiry and account switching across both products (CC-SECURITY-RELEASE-READINESS-03).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Ident = { uid: string; signInProvider: string; issuedAt: number };
const db = vi.hoisted(() => ({
  sessions: new Map<string, { uid: string; signInProvider: string; issuedAt: number } | null>(),
  tokens: new Map<string, { uid: string; signInProvider: string }>(),
  revoked: [] as string[],
  seq: 0,
}));
vi.mock("@/lib/firebase-admin", () => ({
  verifyIdTokenForOwnerLogin: async (t: string) => db.tokens.get(t) ?? null,
  createSessionCookie: async (t: string, ms: number) => {
    const id = db.tokens.get(t);
    if (!id) return null;
    const c = `sess-${++db.seq}-${ms}-${"z".repeat(30)}`;
    db.sessions.set(c, { ...id, issuedAt: Math.floor(Date.now() / 1000) });
    return c;
  },
  verifySessionCookie: async (c: string) => db.sessions.get(c) ?? null,
  revokeSession: async (uid: string) => {
    db.revoked.push(uid);
    for (const [k, v] of db.sessions) if (v?.uid === uid) db.sessions.set(k, null);
  },
}));

import { POST as commandLogin } from "./command-session/route";
import { POST as mettleLogin, GET as mettleWho, DELETE as logout } from "./session/route";
import { requireCommandCenterOwner } from "@/lib/server/command-center-guard";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const OWNER = "the-real-owner-uid";
const SAME = { "sec-fetch-site": "same-origin", "content-type": "application/json" };

class Browser {
  jar: string | null = null;
  private apply(res: Response) {
    const sc = res.headers.get("set-cookie");
    if (!sc) return;
    const m = /__session=([^;]*)/.exec(sc);
    if (!m) return;
    const expired = /Max-Age=0|expires=Thu, 01 Jan 1970/i.test(sc) || m[1] === "";
    this.jar = expired ? null : m[1];
  }
  private req(url: string, method: string, body?: unknown) {
    return new NextRequest("http://localhost" + url, {
      method,
      headers: { ...SAME, ...(this.jar ? { cookie: `__session=${this.jar}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async cc() {
    return requireCommandCenterOwner(this.req("/api/command-center/revenue", "GET"));
  }
  async do(fn: (r: NextRequest) => Promise<Response>, url: string, method: string, body?: unknown) {
    const res = await fn(this.req(url, method, body));
    this.apply(res);
    return res;
  }
}

describe("shared __session cookie across Command Center and METTLE", () => {
  const original = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    db.sessions.clear(); db.tokens.clear(); db.revoked.length = 0; db.seq = 0;
    db.tokens.set("t-owner", { uid: OWNER, signInProvider: "password" });
    db.tokens.set("t-coach", { uid: "coach-uid-123456", signInProvider: "google.com" });
    db.tokens.set("t-athlete", { uid: "athlete-uid-12345", signInProvider: "custom" });
  });
  afterEach(() => (original === undefined ? delete process.env[OWNER_UID_ENV] : (process.env[OWNER_UID_ENV] = original)));

  const ownerLogin = (b: Browser) => b.do(commandLogin, "/api/auth/command-session", "POST", { idToken: "t-owner".padEnd(60, "x") });

  it("owner login via the CC endpoint authorizes CC and is also a valid METTLE session", async () => {
    db.tokens.set("t-owner".padEnd(60, "x"), { uid: OWNER, signInProvider: "password" });
    const b = new Browser();
    expect((await ownerLogin(b)).status).toBe(200);
    expect(await b.cc()).toEqual({ ok: true, uid: OWNER });
    expect((await (await b.do(mettleWho, "/api/auth/session", "GET")).json()).authenticated).toBe(true);
  });

  it("account switching: a METTLE login in the same browser replaces the owner cookie and CC denies it", async () => {
    db.tokens.set("t-owner".padEnd(60, "x"), { uid: OWNER, signInProvider: "password" });
    const b = new Browser();
    await ownerLogin(b);
    expect((await b.cc()).ok).toBe(true);
    await b.do(mettleLogin, "/api/auth/session", "POST", { idToken: "t-coach" });
    const r = await b.cc();
    expect(r).toMatchObject({ ok: false, status: 403, reason: "not_owner" });
    expect((await (await b.do(mettleWho, "/api/auth/session", "GET")).json())).toMatchObject({ authenticated: true, isOwner: false });
  });

  it("an athlete (custom-token) session never opens CC", async () => {
    const b = new Browser();
    await b.do(mettleLogin, "/api/auth/session", "POST", { idToken: "t-athlete" });
    expect((await b.cc()).ok).toBe(false);
  });

  it("owner signing into METTLE (30-day cookie) does NOT keep CC open past 12h", async () => {
    const b = new Browser();
    await b.do(mettleLogin, "/api/auth/session", "POST", { idToken: "t-owner" });
    expect((await b.cc()).ok).toBe(true); // fresh
    const s = db.sessions.get(b.jar!)!;
    db.sessions.set(b.jar!, { ...s, issuedAt: s.issuedAt - 13 * 3600 });
    expect(await b.cc()).toMatchObject({ ok: false, status: 401, reason: "session_expired" });
    expect((await (await b.do(mettleWho, "/api/auth/session", "GET")).json()).authenticated).toBe(true); // METTLE unaffected
  });

  it("logout (DELETE) clears the cookie and revokes server-side, so a copied cookie is dead for both products", async () => {
    const b = new Browser();
    await b.do(mettleLogin, "/api/auth/session", "POST", { idToken: "t-owner" });
    const copied = b.jar!;
    expect((await b.cc()).ok).toBe(true);
    await b.do(logout, "/api/auth/session", "DELETE");
    expect(b.jar).toBeNull();
    expect(db.revoked).toContain(OWNER);
    const replay = new Browser(); replay.jar = copied;
    expect((await replay.cc()).ok).toBe(false);
    expect((await replay.do(mettleWho, "/api/auth/session", "GET")).status).toBe(401);
  });

  it("server-side expiry/revocation (verifier null) denies both", async () => {
    const b = new Browser();
    await b.do(mettleLogin, "/api/auth/session", "POST", { idToken: "t-owner" });
    db.sessions.set(b.jar!, null);
    expect((await b.cc()).ok).toBe(false);
    expect((await b.do(mettleWho, "/api/auth/session", "GET")).status).toBe(401);
  });
});
