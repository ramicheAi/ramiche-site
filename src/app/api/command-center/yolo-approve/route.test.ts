import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const { handleYoloApprove } = vi.hoisted(() => ({
  handleYoloApprove: vi.fn(async () => Response.json({ success: true })),
}));
vi.mock("./handler", () => ({ handleYoloApprove }));

import { POST } from "./route";
import { POST as PIN_POST } from "../auth/pin/route";

const SECRET = "k".repeat(48);
const BODY = { folder: "f", name: "n", agent: "a", action: "reject", decided_by: "Ramon" };

function yoloReq(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/command-center/yolo-approve", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(BODY),
  });
}

describe("POST /api/command-center/yolo-approve founder guard (worked example)", () => {
  beforeEach(() => {
    handleYoloApprove.mockClear();
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("default (CC_FOUNDER_GUARD_ENFORCE unset): unchanged, unguarded behavior", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
    const res = await POST(yoloReq());
    expect(res.status).toBe(200);
    expect(handleYoloApprove).toHaveBeenCalledTimes(1);
  });

  it("enforced for another route only: still unguarded here", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "chat-gate");
    const res = await POST(yoloReq());
    expect(res.status).toBe(200);
    expect(handleYoloApprove).toHaveBeenCalledTimes(1);
  });

  it("enforced: no cookie -> 401 and the handler never runs", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "yolo-approve");
    const res = await POST(yoloReq());
    expect(res.status).toBe(401);
    expect(handleYoloApprove).not.toHaveBeenCalled();
  });

  it("enforced: client-asserted identity and sessionStorage-shaped cookie are rejected", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "yolo-approve");
    const res = await POST(
      yoloReq({
        "x-decided-by": "Ramon",
        "x-founder": "1",
        cookie: `cc-pin-auth=${encodeURIComponent('{"ok":true}')}; ${FOUNDER_SESSION_COOKIE}=true`,
      }),
    );
    expect(res.status).toBe(401);
    expect(handleYoloApprove).not.toHaveBeenCalled();
  });

  it("enforced: expired or wrong-secret cookie -> 401", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const expired = signFounderSession(SECRET, Date.now() - 1);
    const foreign = signFounderSession("z".repeat(48), Date.now() + 60_000);
    for (const v of [expired, foreign]) {
      const res = await POST(yoloReq({ cookie: `${FOUNDER_SESSION_COOKIE}=${v}` }));
      expect(res.status).toBe(401);
    }
    expect(handleYoloApprove).not.toHaveBeenCalled();
  });

  it("enforced but secret missing -> 503 fail closed", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "yolo-approve");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(yoloReq());
    expect(res.status).toBe(503);
    expect(handleYoloApprove).not.toHaveBeenCalled();
  });

  it("enforced: the cookie issued by a correct PIN unlocks the route end to end", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "yolo-approve");
    vi.stubEnv("CC_PIN_HASH", createHash("sha256").update("8642", "utf8").digest("hex"));
    const pinRes = await PIN_POST(
      new NextRequest("http://localhost/api/command-center/auth/pin", {
        method: "POST",
        body: JSON.stringify({ pin: "8642" }),
      }),
    );
    const token = pinRes.cookies.get(FOUNDER_SESSION_COOKIE)?.value;
    expect(token).toBeTruthy();
    const res = await POST(yoloReq({ cookie: `${FOUNDER_SESSION_COOKIE}=${token}` }));
    expect(res.status).toBe(200);
    expect(handleYoloApprove).toHaveBeenCalledTimes(1);
  });
});
