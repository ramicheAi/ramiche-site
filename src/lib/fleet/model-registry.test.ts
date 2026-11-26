import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildRegistry,
  readRegistry,
  selectionOf,
  splitRef,
  validateChange,
  writeAgentModel,
  type RawConfig,
} from "./model-registry";

/**
 * Fixtures mirror the real openclaw.json shape closely enough to prove the rules:
 * a secret that must never leak, two providers, agents with primary plus fallbacks,
 * a model the provider advertises and one it does not.
 */
const FIXTURE: RawConfig = {
  env: { vars: { STRIPE_API_KEY: "sk_live_SHOULD_NEVER_LEAK" } },
  auth: { profiles: { "openai-codex:default": { token: "secret-token" } } },
  models: {
    providers: {
      "claude-max": {
        baseUrl: "http://127.0.0.1:3456/v1",
        models: ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4"],
      },
      lmstudio: { models: [{ id: "qwen/qwen3-14b" }, { id: "google/gemma-4-e4b" }] },
    },
  },
  agents: {
    defaults: { model: { primary: "claude-max/claude-sonnet-5", fallbacks: [] } },
    list: [
      {
        id: "atlas",
        model: { primary: "claude-max/claude-opus-5", fallbacks: ["claude-max/claude-sonnet-5"] },
      },
      { id: "scout", model: "lmstudio/qwen/qwen3-14b" },
      { id: "legacy", model: { primary: "claude-max/claude-opus-4-6", fallbacks: [] } },
    ],
  },
};

let dirs: string[] = [];

function fixtureFile(content: unknown = FIXTURE): string {
  const dir = mkdtempSync(join(tmpdir(), "fleet-registry-"));
  dirs.push(dir);
  const path = join(dir, "openclaw.json");
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return path;
}

afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("registry read", () => {
  it("lists every configured provider and model", () => {
    const reg = readRegistry(fixtureFile(), "2026-11-15T00:00:00.000Z");
    expect(reg.providers.map((p) => p.name)).toEqual(["claude-max", "lmstudio"]);
    expect(reg.providers.find((p) => p.name === "lmstudio")?.models).toEqual([
      "qwen/qwen3-14b",
      "google/gemma-4-e4b",
    ]);
    expect(reg.observedAt).toBe("2026-11-15T00:00:00.000Z");
    expect(reg.source).toBe("openclaw.json");
  });

  it("distinguishes a supported selection from an unsupported one", () => {
    const reg = readRegistry(fixtureFile());
    const atlas = reg.agents.find((a) => a.agentId === "atlas");
    const legacy = reg.agents.find((a) => a.agentId === "legacy");
    expect(atlas?.primary).toBe("claude-max/claude-opus-5");
    expect(atlas?.fallbacks).toEqual(["claude-max/claude-sonnet-5"]);
    expect(atlas?.unsupported).toBe(false);
    // configured, but the provider no longer advertises it
    expect(legacy?.unsupported).toBe(true);
  });

  it("never returns a secret", () => {
    const reg = readRegistry(fixtureFile());
    const serialized = JSON.stringify(reg);
    expect(serialized).not.toContain("sk_live_SHOULD_NEVER_LEAK");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("3456");
  });
});

describe("selection parsing", () => {
  it("handles strings, objects and null", () => {
    expect(selectionOf("a/b")).toEqual({ primary: "a/b", fallbacks: [] });
    expect(selectionOf({ primary: "a/b", fallbacks: ["c/d"] })).toEqual({ primary: "a/b", fallbacks: ["c/d"] });
    expect(selectionOf(undefined)).toEqual({ primary: null, fallbacks: [] });
    expect(splitRef("a/b")).toEqual({ provider: "a", model: "b" });
    expect(splitRef("nope")).toBeNull();
  });
});

describe("validation", () => {
  it("refuses an unknown agent", () => {
    expect(validateChange(FIXTURE, "ghost", "claude-max/claude-opus-5")).toMatchObject({
      ok: false,
      reason: "unknown_agent",
    });
  });

  it("refuses an unknown provider", () => {
    expect(validateChange(FIXTURE, "atlas", "nowhere/model")).toMatchObject({
      ok: false,
      reason: "unknown_provider",
    });
  });

  it("refuses a model the provider does not advertise", () => {
    expect(validateChange(FIXTURE, "atlas", "claude-max/claude-opus-4-6")).toMatchObject({
      ok: false,
      reason: "unsupported_model",
    });
  });

  it("refuses a ref with no provider", () => {
    expect(validateChange(FIXTURE, "atlas", "claude-opus-5")).toMatchObject({
      ok: false,
      reason: "invalid_model_ref",
    });
  });

  it("accepts a configured, advertised model", () => {
    expect(validateChange(FIXTURE, "atlas", "lmstudio/google/gemma-4-e4b")).toEqual({ ok: true });
  });
});

describe("authoritative write", () => {
  it("changes only the primary and verifies it from disk", () => {
    const path = fixtureFile();
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-sonnet-5" });
    expect(result).toMatchObject({ ok: true, verified: true, before: "claude-max/claude-opus-5", after: "claude-max/claude-sonnet-5" });
    if (!result.ok) return;

    expect(existsSync(result.backupPath)).toBe(true);
    const onDisk = JSON.parse(readFileSync(path, "utf8"));
    const atlas = onDisk.agents.list.find((a: { id: string }) => a.id === "atlas");
    expect(atlas.model.primary).toBe("claude-max/claude-sonnet-5");
    // the fallback chain and every unrelated key survive
    expect(atlas.model.fallbacks).toEqual(["claude-max/claude-sonnet-5"]);
    expect(onDisk.env.vars.STRIPE_API_KEY).toBe("sk_live_SHOULD_NEVER_LEAK");
    expect(onDisk.agents.list).toHaveLength(3);
  });

  it("upgrades a plain-string selection to the object form without losing the old value", () => {
    const path = fixtureFile();
    const result = writeAgentModel({ path, agentId: "scout", ref: "lmstudio/google/gemma-4-e4b" });
    expect(result).toMatchObject({ ok: true, before: "lmstudio/qwen/qwen3-14b", after: "lmstudio/google/gemma-4-e4b" });
  });

  it("refuses an unsupported model and leaves the file byte-identical", () => {
    const path = fixtureFile();
    const before = readFileSync(path, "utf8");
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-opus-4-6" });
    expect(result).toMatchObject({ ok: false, reason: "unsupported_model" });
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(existsSync(`${path}.lock`)).toBe(false);
  });

  it("fails closed when another update holds the lock", () => {
    const path = fixtureFile();
    writeFileSync(`${path}.lock`, "999\n");
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-sonnet-5" });
    expect(result).toMatchObject({ ok: false, reason: "locked" });
    // the pre-existing lock is not stolen from the other writer
    expect(readFileSync(`${path}.lock`, "utf8")).toBe("999\n");
  });

  it("reports source_unavailable rather than inventing a registry", () => {
    const dir = mkdtempSync(join(tmpdir(), "fleet-empty-"));
    dirs.push(dir);
    const result = writeAgentModel({ path: join(dir, "openclaw.json"), agentId: "atlas", ref: "claude-max/claude-opus-5" });
    expect(result).toMatchObject({ ok: false, reason: "source_unavailable" });
  });

  it("keeps a backup of the previous file", () => {
    const path = fixtureFile();
    const before = readFileSync(path, "utf8");
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-haiku-4" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(readFileSync(result.backupPath, "utf8")).toBe(before);
  });
});

describe("registry derivation", () => {
  it("warns when a fallback provider is not configured", () => {
    const raw: RawConfig = {
      models: { providers: { "claude-max": { models: ["claude-opus-5"] } } },
      agents: { list: [{ id: "atlas", model: { primary: "claude-max/claude-opus-5", fallbacks: ["ghost/model"] } }] },
    };
    const reg = buildRegistry(raw, "/tmp/x.json");
    expect(reg.warnings.join(" ")).toContain('fallback provider "ghost" is not configured');
  });
});


describe("hardening found by independent review", () => {
  it("keeps the config at 600 after a write", () => {
    const path = fixtureFile();
    chmodSync(path, 0o600);
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-sonnet-5" });
    expect(result.ok).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("refuses prototype-chain providers like __proto__ and constructor", () => {
    for (const provider of ["__proto__", "constructor", "toString"]) {
      expect(validateChange(FIXTURE, "atlas", `${provider}/whatever`)).toMatchObject({
        ok: false,
        reason: "unknown_provider",
      });
    }
  });

  it("refuses a provider that advertises no models instead of skipping the check", () => {
    const raw: RawConfig = {
      models: { providers: { empty: { models: [] }, missing: {} } },
      agents: { list: [{ id: "atlas", model: "claude-max/claude-opus-5" }] },
    };
    expect(validateChange(raw, "atlas", "empty/anything")).toMatchObject({ ok: false, reason: "unverifiable_provider" });
    expect(validateChange(raw, "atlas", "missing/anything")).toMatchObject({ ok: false, reason: "unverifiable_provider" });
  });

  it("treats a non-array agents.list as malformed, not an empty fleet", () => {
    const bad = { models: { providers: {} }, agents: { list: { atlas: {} } } } as unknown as RawConfig;
    expect(() => buildRegistry(bad, "/tmp/x.json")).toThrow(/agents_list_not_array/);
  });

  it("refuses a duplicate agent id rather than writing one and leaving the other stale", () => {
    const path = fixtureFile({
      ...FIXTURE,
      agents: { list: [
        { id: "atlas", model: "claude-max/claude-opus-5" },
        { id: "atlas", model: "claude-max/claude-sonnet-5" },
      ] },
    });
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-haiku-4" });
    expect(result).toMatchObject({ ok: false, reason: "duplicate_agent" });
  });

  it("refuses an array-shaped existing model", () => {
    const path = fixtureFile({
      ...FIXTURE,
      agents: { list: [{ id: "atlas", model: ["claude-max/claude-opus-5"] }] },
    });
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-sonnet-5" });
    expect(result).toMatchObject({ ok: false, reason: "invalid_existing_model" });
  });

  it("restores the backup when the read-back disagrees, through a test seam", () => {
    const path = fixtureFile();
    const before = readFileSync(path, "utf8");
    const result = writeAgentModel({
      path,
      agentId: "atlas",
      ref: "claude-max/claude-sonnet-5",
      // Simulate a write that did not land: report the old value back.
      reader: () => ({ source: "openclaw.json", sourcePath: path, observedAt: "", providers: [], warnings: [], agents: [
        { agentId: "atlas", primary: "claude-max/claude-opus-5", fallbacks: [], unsupported: false },
      ] }),
    });
    expect(result).toMatchObject({ ok: false, reason: "readback_mismatch" });
    expect(readFileSync(path, "utf8")).toBe(before);
    expect(existsSync(`${path}.lock`)).toBe(false);
  });

  it("recovers a lock left by a dead process after the stale window", () => {
    const path = fixtureFile();
    writeFileSync(`${path}.lock`, "999\n");
    const old = new Date(Date.now() - 10 * 60_000);
    // utimes backdates the lock without touching content
    utimesSync(`${path}.lock`, old, old);
    const result = writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-sonnet-5" });
    expect(result).toMatchObject({ ok: true, verified: true });
  });

  it("reports a fresh lock as locked, not as a write failure", () => {
    const path = fixtureFile();
    writeFileSync(`${path}.lock`, "999\n");
    expect(writeAgentModel({ path, agentId: "atlas", ref: "claude-max/claude-sonnet-5" })).toMatchObject({
      ok: false,
      reason: "locked",
    });
  });
});
