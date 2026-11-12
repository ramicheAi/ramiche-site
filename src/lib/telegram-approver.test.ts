import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedTelegramApprover } from "./telegram-cc-bot";

const KEY = "TELEGRAM_APPROVER_IDS";
const saved = process.env[KEY];
afterEach(() => (saved === undefined ? delete process.env[KEY] : (process.env[KEY] = saved)));

describe("isAuthorizedTelegramApprover", () => {
  it("fails closed when TELEGRAM_APPROVER_IDS is unset, blank or malformed", () => {
    delete process.env[KEY];
    expect(isAuthorizedTelegramApprover({ id: 12345 })).toBe(false);
    for (const v of ["", "   ", ",", "abc", "-5", "12.5", "{\"id\":1}"]) {
      process.env[KEY] = v;
      expect(isAuthorizedTelegramApprover({ id: 12345 }), v).toBe(false);
    }
  });
  it("allows only an exact numeric id in the list", () => {
    process.env[KEY] = " 111 , 222 ";
    expect(isAuthorizedTelegramApprover({ id: 111 })).toBe(true);
    expect(isAuthorizedTelegramApprover({ id: 222 })).toBe(true);
    expect(isAuthorizedTelegramApprover({ id: 11 })).toBe(false);
    expect(isAuthorizedTelegramApprover({ id: 1111 })).toBe(false);
  });
  it("rejects missing from, bots, string/zero/negative/unsafe ids", () => {
    process.env[KEY] = "111";
    expect(isAuthorizedTelegramApprover(undefined)).toBe(false);
    expect(isAuthorizedTelegramApprover(null)).toBe(false);
    expect(isAuthorizedTelegramApprover({ id: 111, is_bot: true })).toBe(false);
    expect(isAuthorizedTelegramApprover({ id: "111" })).toBe(false);
    expect(isAuthorizedTelegramApprover({ id: 0 })).toBe(false);
    expect(isAuthorizedTelegramApprover({ id: -111 })).toBe(false);
    expect(isAuthorizedTelegramApprover({ id: Number.MAX_SAFE_INTEGER + 2 })).toBe(false);
  });
});
