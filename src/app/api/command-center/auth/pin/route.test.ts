import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { FOUNDER_SESSION_COOKIE, verifyFounderSessionToken } from "@/lib/server/founder-authority";

const PIN = "8642";
const SECRET = "x".repeat(48);

function pinReq(pin: string) {
  return new NextRequest("http://localhost/api/command-center/auth/pin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin }),
  });
}

describe("POST /api/command-center/auth/pin founder session", () => {
  beforeEach(() => {
    vi.stubEnv("CC_PIN_HASH", createHash("sha256").update(PIN, "utf8").digest("hex"));
    vi.stubEnv("CC_PIN", "");
    vi.stubEnv("CC_PIN_ALLOW_DEV", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("issues a signed httpOnly strict cookie on the correct PIN when the secret is configured", async () => {
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
    const res = await POST(pinReq(PIN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    const cookie = res.cookies.get(FOUNDER_SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(cookie!.value);
    expect(verifyFounderSessionToken(cookie!.value, SECRET).authorized).toBe(true);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=strict/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/Path=\/api\/command-center/);
  });

  it("issues no cookie on a wrong PIN", async () => {
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
    const res = await POST(pinReq("0000"));
    expect(res.status).toBe(401);
    expect(res.cookies.get(FOUNDER_SESSION_COOKIE)).toBeUndefined();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("keeps today's response (no cookie) on a correct PIN when the secret is not configured", async () => {
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(pinReq(PIN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("issues a cookie via the plaintext CC_PIN path too", async () => {
    vi.stubEnv("CC_PIN_HASH", "");
    vi.stubEnv("CC_PIN", PIN);
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
    const ok = await POST(pinReq(PIN));
    expect(ok.cookies.get(FOUNDER_SESSION_COOKIE)?.value).toBeTruthy();
    const bad = await POST(pinReq("1111"));
    expect(bad.headers.get("set-cookie")).toBeNull();
  });
});
