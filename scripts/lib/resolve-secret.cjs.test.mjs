import { describe, expect, it, vi } from "vitest";
import { resolveSecret } from "./resolve-secret.cjs";

// Same contract as resolve-secret.mjs's own test file -- kept short since the two are meant to be
// line-for-line identical logic (see resolve-secret.cjs's comment on why they're separate files).
describe("resolveSecret (CJS) — file-backed secret with env-var fallback", () => {
  it("reads from the file when set and present, else falls back to the env var", () => {
    const fsYes = { existsSync: vi.fn(() => true), readFileSync: vi.fn(() => "from-file\n") };
    expect(resolveSecret({ X_FILE: "/f", X: "from-env" }, fsYes, "X_FILE", "X")).toBe("from-file");

    const fsNo = { existsSync: vi.fn(() => false), readFileSync: vi.fn() };
    expect(resolveSecret({ X: "from-env" }, fsNo, "X_FILE", "X")).toBe("from-env");
    expect(resolveSecret({ X_FILE: "/missing", X: "from-env" }, fsNo, "X_FILE", "X")).toBe("from-env");
    expect(resolveSecret({}, fsNo, "X_FILE", "X")).toBe("");
  });
});
