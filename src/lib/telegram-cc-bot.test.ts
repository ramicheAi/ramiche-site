import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyTelegramWebhookSecret } from "./telegram-cc-bot";

function reqWith(header: string | null): { headers: Headers } {
  const headers = new Headers();
  if (header !== null) headers.set("X-Telegram-Bot-Api-Secret-Token", header);
  return { headers };
}

describe("verifyTelegramWebhookSecret", () => {
  const ORIGINAL = process.env.TELEGRAM_WEBHOOK_SECRET;

  beforeEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = ORIGINAL;
  });

  it("rejects every request when the secret is unset (fail closed, not fail open)", () => {
    expect(verifyTelegramWebhookSecret(reqWith(null))).toBe(false);
    expect(verifyTelegramWebhookSecret(reqWith(""))).toBe(false);
    expect(verifyTelegramWebhookSecret(reqWith("anything"))).toBe(false);
  });

  it("rejects every request when the secret is set to only whitespace (fail closed)", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "   \n\t  ";
    expect(verifyTelegramWebhookSecret(reqWith(null))).toBe(false);
    expect(verifyTelegramWebhookSecret(reqWith("anything"))).toBe(false);
  });

  it("rejects a missing header when a secret is configured", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cr3t";
    expect(verifyTelegramWebhookSecret(reqWith(null))).toBe(false);
  });

  it("rejects a wrong header value when a secret is configured", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cr3t";
    expect(verifyTelegramWebhookSecret(reqWith("wrong"))).toBe(false);
  });

  it("rejects a header value that is a prefix or superstring of the secret", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cr3t";
    expect(verifyTelegramWebhookSecret(reqWith("s3cr3"))).toBe(false);
    expect(verifyTelegramWebhookSecret(reqWith("s3cr3tt"))).toBe(false);
  });

  it("accepts the exact configured secret", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "s3cr3t";
    expect(verifyTelegramWebhookSecret(reqWith("s3cr3t"))).toBe(true);
  });

  it("accepts the secret even if the env var has trailing/leading whitespace", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "  s3cr3t\n";
    expect(verifyTelegramWebhookSecret(reqWith("s3cr3t"))).toBe(true);
  });
});
