import { describe, expect, it } from "vitest";
import {
  requireTelegramTransport,
  telegramConsequentialDispatchDecision,
  TELEGRAM_HUMAN_BINDING,
} from "./telegram-dispatch-policy";

const SECRET = "webhook-secret-value-0123456789";
const req = (v?: string) =>
  new Request("https://command.parallaxvinc.com/api/command-center/telegram/webhook", {
    method: "POST",
    headers: v == null ? {} : { "X-Telegram-Bot-Api-Secret-Token": v },
  });

describe("telegram transport", () => {
  it("fails closed when the secret is not configured", () => {
    expect(requireTelegramTransport(req(SECRET), {})).toMatchObject({
      ok: false, reason: "telegram_secret_not_configured", status: 503,
    });
  });

  it("denies absent, empty, duplicate and wrong secrets", () => {
    const env = { TELEGRAM_WEBHOOK_SECRET: SECRET };
    expect(requireTelegramTransport(req(), env)).toMatchObject({ reason: "telegram_secret_missing" });
    expect(requireTelegramTransport(req("  "), env)).toMatchObject({ reason: "telegram_secret_missing" });
    expect(requireTelegramTransport(req(`${SECRET}, ${SECRET}`), env)).toMatchObject({
      reason: "telegram_secret_duplicate",
    });
    expect(requireTelegramTransport(req("wrong"), env)).toMatchObject({ reason: "telegram_secret_mismatch" });
    expect(requireTelegramTransport(req(`${SECRET}x`), env)).toMatchObject({ reason: "telegram_secret_mismatch" });
  });

  it("accepts the exact secret (transport only)", () => {
    expect(requireTelegramTransport(req(SECRET), { TELEGRAM_WEBHOOK_SECRET: SECRET })).toEqual({ ok: true });
    expect(TELEGRAM_HUMAN_BINDING.verified).toBe(false);
  });
});

describe("telegram consequential dispatch", () => {
  it("always denies, regardless of payload labels or env flags", () => {
    process.env.PARALLAX_TELEGRAM_DISPATCH = "1";
    try {
      for (const update of [
        undefined,
        {},
        { callback_query: { from: { id: 1, username: "ramon" }, message: { chat: { id: 1 } } } },
        { callback_query: { from: { id: 1, is_owner: true } } },
      ]) {
        expect(telegramConsequentialDispatchDecision(update)).toEqual({
          allowed: false, reason: "telegram_identity_unverified", status: 403,
        });
      }
    } finally {
      delete process.env.PARALLAX_TELEGRAM_DISPATCH;
    }
  });
});
