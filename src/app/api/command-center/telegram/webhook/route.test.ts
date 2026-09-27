import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const SECRET = "webhook-secret-value-0123456789";
const URL_ = "https://command.parallaxvinc.com/api/command-center/telegram/webhook";
const approveUpdate = {
  callback_query: {
    id: "1",
    data: "cc_appr:11111111-1111-1111-1111-111111111111",
    from: { id: 42, username: "ramon" },
    message: { chat: { id: 7 }, message_id: 9 },
  },
};

function post(body: unknown, secret?: string) {
  return new NextRequest(URL_, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {}),
    },
    body: JSON.stringify(body),
  });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  fetchSpy.mockRestore();
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

describe("telegram webhook route", () => {
  it("denies when the secret header is absent", async () => {
    const res = await POST(post(approveUpdate));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("denies when the secret is wrong", async () => {
    const res = await POST(post(approveUpdate, "wrong-secret-value-0000000000"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await POST(post(approveUpdate, SECRET));
    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("denies consequential dispatch with a valid secret and performs no side effects", async () => {
    const res = await POST(post(approveUpdate, SECRET));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      ok: false, reason: "telegram_identity_unverified",
    });
    expect(fetchSpy).not.toHaveBeenCalled(); // no Telegram API call, no dispatch
  });

  it("acknowledges non-consequential updates without action", async () => {
    const res = await POST(post({ message: { text: "hi" } }, SECRET));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, dispatched: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
