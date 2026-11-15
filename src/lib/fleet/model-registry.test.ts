import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
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
