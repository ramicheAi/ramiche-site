import { describe, expect, it } from "vitest";
import { configuredOwnerUid, isHumanProvider, isOwnerUid, OWNER_UID_ENV } from "./command-center-auth";

describe("configuredOwnerUid", () => {
  it("returns null when the env var is absent", () => {
    expect(configuredOwnerUid({})).toBeNull();
  });

  it("returns null for an empty/whitespace-only value (denies, never a wildcard)", () => {
    expect(configuredOwnerUid({ [OWNER_UID_ENV]: "   " })).toBeNull();
  });

  it("returns null for a malformed value (JSON, multi-value, control chars)", () => {
    expect(configuredOwnerUid({ [OWNER_UID_ENV]: '{"uid":"abc"}' })).toBeNull();
    expect(configuredOwnerUid({ [OWNER_UID_ENV]: "abc,def" })).toBeNull();
    expect(configuredOwnerUid({ [OWNER_UID_ENV]: "short" })).toBeNull();
  });

  it("returns the trimmed uid for a well-formed value", () => {
    expect(configuredOwnerUid({ [OWNER_UID_ENV]: "  real-owner-uid-123  " })).toBe("real-owner-uid-123");
  });
});

describe("isOwnerUid", () => {
  it("is true only for an exact match", () => {
    expect(isOwnerUid("abc123", "abc123")).toBe(true);
    expect(isOwnerUid("abc123", "abc124")).toBe(false);
  });

  it("is false for different-length strings (no timing-safe-equal length throw)", () => {
    expect(isOwnerUid("short", "a-much-longer-uid")).toBe(false);
  });

  it("is false for empty inputs", () => {
    expect(isOwnerUid("", "abc123")).toBe(false);
    expect(isOwnerUid("abc123", "")).toBe(false);
  });
});

describe("isHumanProvider", () => {
  it("accepts real human sign-in providers", () => {
    expect(isHumanProvider("password")).toBe(true);
    expect(isHumanProvider("google.com")).toBe(true);
  });

  it("rejects anonymous and custom-token identities (athlete PIN flows)", () => {
    expect(isHumanProvider("anonymous")).toBe(false);
    expect(isHumanProvider("custom")).toBe(false);
  });

  it("rejects undefined/unknown providers", () => {
    expect(isHumanProvider(undefined)).toBe(false);
    expect(isHumanProvider("made-up-provider")).toBe(false);
  });
});
