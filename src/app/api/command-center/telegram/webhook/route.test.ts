import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { approve, answer } = vi.hoisted(() => ({ approve: vi.fn(), answer: vi.fn() }));
vi.mock("@/lib/cc-approve-synthesis", () => ({ approveSynthesisMessage: approve }));
vi.mock("@/lib/telegram-cc-bot", async (orig) => ({
  ...(await orig<typeof import("@/lib/telegram-cc-bot")>()),
  telegramAnswerCallbackQuery: answer,
}));

import { POST } from "./route";

const SECRET = "tg-webhook-secret-test";
const ID = "123e4567-e89b-12d3-a456-426614174000";
const upd = (fromId: unknown) => ({
  callback_query: { id: "cb1", data: `cc_appr:${ID}`, from: fromId === undefined ? undefined : { id: fromId }, message: { chat: { id: 9 }, message_id: 7 } },
});
const call = (body: unknown, secret: string | null = SECRET) =>
  POST(new Request("http://localhost/api/command-center/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {}) },
    body: JSON.stringify(body),
  }) as never);

describe("telegram approval callback requires an authorized approver", () => {
  const env = { s: process.env.TELEGRAM_WEBHOOK_SECRET, a: process.env.TELEGRAM_APPROVER_IDS };
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    process.env.TELEGRAM_APPROVER_IDS = "555";
    approve.mockReset().mockResolvedValue({ ok: true, executed: 1, total: 1, blocked: 0 });
    answer.mockReset();
  });
  afterEach(() => {
    for (const [k, v] of [["TELEGRAM_WEBHOOK_SECRET", env.s], ["TELEGRAM_APPROVER_IDS", env.a]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  it("a valid-secret request from an unlisted user never approves", async () => {
    await call(upd(999));
    expect(approve).not.toHaveBeenCalled();
    expect(answer).toHaveBeenCalledWith("cb1", expect.stringContaining("Not authorized"), true);
  });
  it("a missing `from` never approves", async () => {
    await call(upd(undefined));
    expect(approve).not.toHaveBeenCalled();
  });
  it("approver list unset fails closed even for a plausible id", async () => {
    delete process.env.TELEGRAM_APPROVER_IDS;
    await call(upd(555));
    expect(approve).not.toHaveBeenCalled();
  });
  it("the listed approver can approve", async () => {
    await call(upd(555));
    expect(approve).toHaveBeenCalledWith(ID);
  });
  it("wrong webhook secret is 401 before anything", async () => {
    expect((await call(upd(555), "nope")).status).toBe(401);
    expect(approve).not.toHaveBeenCalled();
  });
});
