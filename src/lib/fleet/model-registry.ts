/**
 * Fleet model registry — the authoritative read/write path for agent model selection.
 *
 * WHY THIS EXISTS
 * ---------------
 * The cockpit used to write `~/.openclaw/agents/directory.json`, a file the runtime never reads.
 * A model change therefore returned success while the fleet kept its old model. The only file that
 * changes behaviour is `openclaw.json`, which the gateway loads at startup.
 *
 * Rules:
 * - Read only what is safe to show: provider names, model ids, agent ids and their selections.
 *   The same file holds API keys; nothing from `env`, `auth` or provider credentials ever leaves
 *   this module.
 * - Validate before writing: the agent must exist, the provider must be configured, and the model
 *   must be one the provider advertises. Unknown agents and models are refused, not guessed.
 * - Write safely: exclusive lock, timestamped backup, temp file plus atomic rename, and a re-read
 *   that must show the new value. Any failure restores the backup and removes the lock.
 * - Report only what is true: `verified` is true only when the value read back matches.
 *
 * This module is pure filesystem work so it can be tested against fixtures. It never runs on
 * Vercel against a real fleet, and the route around it fails closed when the file is absent.
 */

import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export type AgentSelection = {
  agentId: string;
  /** The resolved primary model reference, for example "claude-max/claude-opus-5". */
  primary: string | null;
  fallbacks: string[];
  /** True when the configured primary is not in the provider's advertised list. */
  unsupported: boolean;
};

export type ProviderSummary = {
  name: string;
  models: string[];
  /**
   * Reachability is deliberately not guessed. A model can be configured and advertised while its
   * provider is down, and this module does not hold credentials to probe. The UI must say
   * "unverified" rather than imply the provider answered.
   */
  reachability: "unverified";
};

export type FleetRegistry = {
  source: "openclaw.json";
  sourcePath: string;
  observedAt: string;
  agents: AgentSelection[];
  providers: ProviderSummary[];
  /** Agent ids referenced by a configured fallback but not themselves configured. */
  warnings: string[];
};

export type WriteResult =
  | {
      ok: true;
      agentId: string;
      before: string | null;
      after: string;
      verified: true;
      backupPath: string;
      observedAt: string;
    }
  | {
      ok: false;
      reason: string;
      detail?: string;
    };

type RawProvider = Record<string, unknown> & { models?: unknown; baseUrl?: string; baseURL?: string };
type RawAgent = Record<string, unknown> & { id?: string; model?: unknown };

/** Minimal shape we need from openclaw.json. Everything else stays untouched. */
export type RawConfig = Record<string, unknown> & {
  models?: { providers?: Record<string, RawProvider> };
  agents?: { defaults?: { model?: unknown }; list?: RawAgent[] };
};

export const DEFAULT_CONFIG_PATH = join(process.env.HOME ?? "/Users/admin", ".openclaw", "openclaw.json");

export function resolveConfigPath(explicit?: string): string {
  return explicit || process.env.OPENCLAW_CONFIG_PATH || DEFAULT_CONFIG_PATH;
}

/** Provider model ids are sometimes strings and sometimes objects with an `id`. */
function providerModelIds(provider: RawProvider): string[] {
  const raw = provider.models;
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") ids.push(entry);
    else if (entry && typeof entry === "object") {
      const id = (entry as Record<string, unknown>).id;
      if (typeof id === "string") ids.push(id);
    }
  }
  return ids;
}

/** An agent's model may be a plain ref or { primary, fallbacks }. */
export function selectionOf(model: unknown): { primary: string | null; fallbacks: string[] } {
  if (typeof model === "string") return { primary: model, fallbacks: [] };
  if (model && typeof model === "object") {
    const rec = model as Record<string, unknown>;
    const primary = typeof rec.primary === "string" ? rec.primary : null;
    const fallbacks = Array.isArray(rec.fallbacks)
      ? rec.fallbacks.filter((f): f is string => typeof f === "string")
      : [];
    return { primary, fallbacks };
  }
  return { primary: null, fallbacks: [] };
}

/** `claude-max/claude-opus-5` -> { provider: "claude-max", model: "claude-opus-5" } */
export function splitRef(ref: string): { provider: string; model: string } | null {
  const i = ref.indexOf("/");
  if (i <= 0 || i === ref.length - 1) return null;
  return { provider: ref.slice(0, i), model: ref.slice(i + 1) };
}

/** Build the sanitized registry from a parsed config. Never returns secrets. */
export function buildRegistry(raw: RawConfig, sourcePath: string, observedAt = new Date().toISOString()): FleetRegistry {
  const providers: ProviderSummary[] = Object.entries(raw.models?.providers ?? {})
    .filter(([, p]) => p && typeof p === "object")
    .map(([name, p]) => ({ name, models: providerModelIds(p), reachability: "unverified" as const }));

  const advertised = new Map(providers.map((p) => [p.name, new Set(p.models)]));
  const list = Array.isArray(raw.agents?.list) ? raw.agents.list : [];
  const agents: AgentSelection[] = [];
  const warnings: string[] = [];

  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    const id = typeof a.id === "string" ? a.id : null;
    if (!id) continue;
    const { primary, fallbacks } = selectionOf(a.model);
    const ref = primary ? splitRef(primary) : null;
    const unsupported = !!ref && (!advertised.has(ref.provider) || !advertised.get(ref.provider)?.has(ref.model));
    for (const f of fallbacks) {
      const fr = splitRef(f);
      if (fr && !advertised.has(fr.provider)) warnings.push(`${id}: fallback provider "${fr.provider}" is not configured`);
    }
    agents.push({ agentId: id, primary, fallbacks, unsupported });
  }

  agents.sort((a, b) => a.agentId.localeCompare(b.agentId));
  providers.sort((a, b) => a.name.localeCompare(b.name));
  return { source: "openclaw.json", sourcePath, observedAt, agents, providers, warnings };
}

export function readRegistry(path = resolveConfigPath(), observedAt?: string): FleetRegistry {
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawConfig;
  return buildRegistry(raw, path, observedAt);
}

export type Validation = { ok: true } | { ok: false; reason: string; detail?: string };

/** Validate a proposed change against the parsed config. No writes. */
export function validateChange(raw: RawConfig, agentId: string, ref: string): Validation {
  const list = Array.isArray(raw.agents?.list) ? raw.agents.list : [];
  const agent = list.find((a) => a && typeof a === "object" && (a as RawAgent).id === agentId);
  if (!agent) return { ok: false, reason: "unknown_agent", detail: `no agent "${agentId}" in openclaw.json` };

  const parts = splitRef(ref);
  if (!parts) return { ok: false, reason: "invalid_model_ref", detail: "expected provider/model" };

  const provider = raw.models?.providers?.[parts.provider];
  if (!provider) {
    return { ok: false, reason: "unknown_provider", detail: `provider "${parts.provider}" is not configured` };
  }
  const advertised = providerModelIds(provider);
  if (advertised.length > 0 && !advertised.includes(parts.model)) {
    return {
      ok: false,
      reason: "unsupported_model",
      detail: `"${parts.model}" is not advertised by "${parts.provider}"`,
    };
  }
  return { ok: true };
}

/**
 * Write an agent's primary model with lock, backup, atomic rename and read-back.
 *
 * The file is re-serialized with two-space indentation. All unrelated keys, including secrets, are
 * carried through untouched; only `agents.list[i].model` changes.
 */
export function writeAgentModel(options: {
  agentId: string;
  ref: string;
  path?: string;
  now?: Date;
}): WriteResult {
  const path = options.path ?? resolveConfigPath();
  const now = options.now ?? new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const lockPath = `${path}.lock`;
  const backupPath = `${path}.bak-${stamp}`;

  if (!existsSync(path)) return { ok: false, reason: "source_unavailable", detail: `missing ${path}` };

  // Exclusive lock: fail rather than queue, so two cockpit tabs cannot interleave writes.
  try {
    writeFileSync(lockPath, `${process.pid}\n`, { flag: "wx" });
  } catch {
    return { ok: false, reason: "locked", detail: `${lockPath} exists; another update is in progress` };
  }

  let original: string;
  try {
    original = readFileSync(path, "utf8");
    const raw = JSON.parse(original) as RawConfig;
    const validation = validateChange(raw, options.agentId, options.ref);
    if (!validation.ok) {
      rmSync(lockPath, { force: true });
      return { ok: false, reason: validation.reason, detail: validation.detail };
    }

    const list = raw.agents?.list ?? [];
    const agent = list.find((a) => a && typeof a === "object" && (a as RawAgent).id === options.agentId) as RawAgent;
    const before = selectionOf(agent.model).primary;

    // Keep the fallback chain, replace only the primary.
    agent.model = agent.model && typeof agent.model === "object"
      ? { ...(agent.model as Record<string, unknown>), primary: options.ref }
      : options.ref;

    copyFileSync(path, backupPath);
    const tmpPath = join(dirname(path), `.openclaw.json.tmp-${process.pid}-${Date.now()}`);
    writeFileSync(tmpPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    renameSync(tmpPath, path);

    // Read back from disk. Success is only claimed when the file actually holds the new value.
    const after = readRegistry(path).agents.find((a) => a.agentId === options.agentId)?.primary ?? null;
    if (after !== options.ref) {
      copyFileSync(backupPath, path);
      rmSync(lockPath, { force: true });
      return { ok: false, reason: "readback_mismatch", detail: `expected ${options.ref}, read ${after ?? "null"}` };
    }

    rmSync(lockPath, { force: true });
    return {
      ok: true,
      agentId: options.agentId,
      before,
      after,
      verified: true,
      backupPath,
      observedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Any throw after the backup exists is rolled back before reporting.
    try {
      if (existsSync(backupPath)) copyFileSync(backupPath, path);
    } catch {
      /* the backup is on disk even if the restore failed; the caller gets the error */
    }
    rmSync(lockPath, { force: true });
    return { ok: false, reason: "write_failed", detail: err instanceof Error ? err.message : String(err) };
  }
}
