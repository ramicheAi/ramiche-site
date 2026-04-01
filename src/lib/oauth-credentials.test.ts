import { describe, it, expect, afterEach, vi } from "vitest";
import {
  generateClientCredentials,
  issueToken,
  validateToken,
  revokeToken,
} from "./oauth-credentials";

describe("oauth-credentials", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates prefixed credentials", () => {
    const c = generateClientCredentials(["read"]);
    expect(c.clientId.startsWith("cid_")).toBe(true);
    expect(c.clientSecret.startsWith("cs_")).toBe(true);
  });

  it("generateClientCredentials stores scopes", () => {
    const c = generateClientCredentials(["read", "write"]);
    expect(c.scopes).toEqual(["read", "write"]);
  });

  it("validateToken returns scopes for issued token", () => {
    const c = generateClientCredentials(["read"]);
    const t = issueToken(c.clientId, c.clientSecret, c)!;
    expect(validateToken(t.token).scopes).toEqual(["read"]);
  });

  it("issueToken rejects mismatch", () => {
    const c = generateClientCredentials();
    expect(issueToken("x", c.clientSecret, c)).toBeNull();
  });

  it("issueToken rejects wrong client secret", () => {
    const c = generateClientCredentials();
    expect(issueToken(c.clientId, "wrong", c)).toBeNull();
  });

  it("generateClientCredentials defaults scopes to read", () => {
    const c = generateClientCredentials();
    expect(c.scopes).toEqual(["read"]);
  });

  it("issueToken rejects expired client registration", () => {
    const c = generateClientCredentials();
    const expired = { ...c, expiresAt: Date.now() - 60_000 };
    expect(issueToken(c.clientId, c.clientSecret, expired)).toBeNull();
  });

  it("validateToken accepts issued token", () => {
    const c = generateClientCredentials();
    const t = issueToken(c.clientId, c.clientSecret, c)!;
    expect(validateToken(t.token).valid).toBe(true);
  });

  it("validateToken expires after window", () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    vi.setSystemTime(t0);
    const c = generateClientCredentials();
    const tok = issueToken(c.clientId, c.clientSecret, c)!;
    vi.setSystemTime(t0 + 61 * 60 * 1000);
    expect(validateToken(tok.token).valid).toBe(false);
  });

  it("revokeToken removes", () => {
    const c = generateClientCredentials();
    const t = issueToken(c.clientId, c.clientSecret, c)!;
    expect(revokeToken(t.token)).toBe(true);
    expect(validateToken(t.token).valid).toBe(false);
  });

  it("validateToken rejects unknown token", () => {
    expect(validateToken("mt_not_issued").valid).toBe(false);
    expect(validateToken("mt_not_issued").scopes).toEqual([]);
  });

  it("revokeToken returns false for unknown token", () => {
    expect(revokeToken("mt_unknown")).toBe(false);
  });
});
