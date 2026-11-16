import { describe, expect, it, vi } from "vitest";
import { resolveSecret } from "./resolve-secret.mjs";

describe("resolveSecret — file-backed secret with env-var fallback", () => {
  it("reads from the file when the *_FILE path is set and the file exists", () => {
    const fs = {
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => "value-from-file\n"),
    };
    const env = { SECRET_FILE: "/run/secrets/x", SECRET: "value-from-env" };
    expect(resolveSecret(env, fs, "SECRET_FILE", "SECRET")).toBe("value-from-file");
    expect(fs.readFileSync).toHaveBeenCalledWith("/run/secrets/x", "utf8");
  });

  it("falls back to the direct env var when no *_FILE path is set", () => {
    const fs = { existsSync: vi.fn(), readFileSync: vi.fn() };
    const env = { SECRET: "value-from-env" };
    expect(resolveSecret(env, fs, "SECRET_FILE", "SECRET")).toBe("value-from-env");
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it("falls back to the direct env var when the *_FILE path is set but the file is missing", () => {
    // A stale or mistyped path must not silently resolve to an empty secret while a perfectly
    // good env var sits right there — this is exactly the "accidentally lock yourself out at
    // cutover" failure mode the design has to avoid.
    const fs = { existsSync: vi.fn(() => false), readFileSync: vi.fn() };
    const env = { SECRET_FILE: "/run/secrets/missing", SECRET: "value-from-env" };
    expect(resolveSecret(env, fs, "SECRET_FILE", "SECRET")).toBe("value-from-env");
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it("returns an empty string when neither is set", () => {
    const fs = { existsSync: vi.fn(() => false), readFileSync: vi.fn() };
    expect(resolveSecret({}, fs, "SECRET_FILE", "SECRET")).toBe("");
  });

  it("trims trailing newlines from a file-sourced value", () => {
    // echo > file (as used to stage the new secret) appends a trailing newline; a raw compare
    // against an incoming header with no newline must not fail because of it.
    const fs = { existsSync: vi.fn(() => true), readFileSync: vi.fn(() => "abc123\n") };
    expect(resolveSecret({ SECRET_FILE: "/f" }, fs, "SECRET_FILE", "SECRET")).toBe("abc123");
  });
});
