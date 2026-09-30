/**
 * Canonical agent registry, SERVER-ONLY details (P06 Packet 1).
 *
 * Identity lives in `agent-registry-core.ts` (client-safe). This module adds the
 * internal per-agent configuration keyed by the same `id`: persona, OpenClaw session
 * key, runtime tier and the declared directory metadata. DO NOT import this module
 * from browser code; client-facing modules must import `agent-registry-core` only
 * (enforced by `agent-registry.test.ts`).
 *
 * TRUTH RULES
 * - `runtime` records what the code in this repo actually does today. For
 *   `/api/command-center/chat` (non-stream, claude-max proxy path) the model is
 *   the tier default (`claude-opus-4-6` / `claude-sonnet-4-6` / `claude-haiku-4-5`),
 *   overridable by CC_CLAUDE_MODEL_{OPUS,SONNET,HAIKU}. When OpenClaw is the
 *   primary path (OPENCLAW_CHAT_PRIMARY=1) the model is set by OpenClaw's own
 *   agent config, which is outside this repo: UNKNOWN here.
 *   The streaming route (`chat/stream`) picks its model per provider
 *   (gemini-2.0-flash, deepseek-chat, anthropic/claude-sonnet-4), never per agent.
 * - `declared` is what the roster API / export currently CLAIM (the old
 *   STATIC_AGENTS fallback, aligned with the OpenClaw directory.json). It is kept
 *   verbatim so the API output does not change, and it disagrees with `runtime`
 *   for several agents. Use `declaredVsRuntime()` to see the gaps.
 * - `"unknown"` is an explicit value, never a silent default.
 *
 * WHY THE TIERS ARE WHAT THEY ARE (moved here from chat/route.ts, unchanged in meaning):
 * ATLAS gets Opus (orchestrator) and SIMONS gets Opus. Specialists that do real reasoning get
 * Sonnet. Any agent whose value comes from a STRONG, distinct persona (sales, brand, copy,
 * community, support, music, fabrication) also gets Sonnet: Haiku's safety guardrails kick in too
 * aggressively and the agent breaks character ("I'm Claude, an Anthropic assistant") on a formal
 * handoff prompt. Only TRIAGE stays on Haiku, a pure log-analysis utility with no customer-facing
 * persona to maintain. The tier -> model string mapping and env overrides live in
 * `provider-adapter.ts` (`claudeModelForTier`).
 */

import { AGENT_CORE, chatAgentIds, agentDmUuidMap, type AgentCore, type AgentChannel } from "@/lib/agent-registry-core";

export { AGENT_CORE, chatAgentIds, agentDmUuidMap };
export type { AgentCore, AgentChannel };

export type ClaudeTier = "opus" | "sonnet" | "haiku";

export interface AgentDeclared {
  /** Provider label as declared in the directory (not verified against runtime). */
  readonly provider: string;
  /** Model string as declared in the directory (not verified against runtime). */
  readonly model: string;
  readonly capabilities: readonly string[];
  readonly skills?: readonly string[];
  readonly escalationLevel: string;
  readonly providerNote?: string;
}

export interface AgentServerDetails {
  /** Role slug as served by the roster API. */
  readonly role: string;
  readonly description: string;
  readonly personaStyle: string | null;
  /** OpenClaw session key (backend/adapter target); null = none known. */
  readonly openclawSessionKey: string | null;
  readonly runtime: { readonly claudeTier: ClaudeTier | "unknown" };
  readonly declared: AgentDeclared;
}

export type AgentDefinition = AgentCore & AgentServerDetails;

const AGENT_SERVER_DETAILS: Readonly<Record<string, AgentServerDetails>> = {
  "archivist": {
    role: "workspace-indexer",
    description: "Workspace indexer: file lookup, route mapping, codebase queries",
    personaStyle: null,
    openclawSessionKey: null,
    runtime: { claudeTier: "unknown" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["file-lookup", "route-mapping", "codebase-queries"],
      escalationLevel: "level-0",
    },
  },
  "atlas": {
    role: "operations-lead",
    description: "Operations Lead & Strategic Command",
    personaStyle: "Calm, sharp, direct. Systems thinker.",
    openclawSessionKey: "agent:main:main",
    runtime: { claudeTier: "opus" },
    declared: {
      provider: "claude-max",
      model: "claude-opus-4-6",
      capabilities: ["planning", "delegation", "review", "orchestration"],
      escalationLevel: "final",
    },
  },
  "triage": {
    role: "debugging",
    description: "Debugging & Log Analysis",
    personaStyle: "Methodical, detail-oriented. Asks clarifying questions.",
    openclawSessionKey: "agent:triage:main",
    runtime: { claudeTier: "haiku" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["debugging", "failure-tracing", "log-analysis", "system-health"],
      skills: ["app-log-analyzer", "log-analyzer", "coding-agent"],
      escalationLevel: "specialist",
    },
  },
  "shuri": {
    role: "engineering",
    description: "Frontend Engineering & Code Generation",
    personaStyle: "Fast-moving, practical. Code-first answers.",
    openclawSessionKey: "agent:shuri:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["code-generation", "refactoring", "patches", "builds", "ui-design"],
      skills: ["ui-ux-pro-max", "nano-banana-pro", "coding-agent"],
      escalationLevel: "executor",
    },
  },
  "proximon": {
    role: "architecture",
    description: "Systems Architecture & Infrastructure",
    personaStyle: "Thoughtful, architectural. Considers scale.",
    openclawSessionKey: "agent:proximon:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["systems-architecture", "infrastructure-design", "escalation-target"],
      skills: ["contextplus", "dns-networking"],
      escalationLevel: "specialist",
    },
  },
  "aetherion": {
    role: "creative-director",
    description: "Creative Director & Visual Design",
    personaStyle: "Visionary, aesthetic-focused. Thinks in imagery.",
    openclawSessionKey: "agent:aetherion:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "openrouter",
      model: "gemini-3.1-pro-preview",
      capabilities: ["conceptual-frameworks", "design-architecture", "image-generation", "visual-identity"],
      skills: ["ui-ux-pro-max", "nano-banana-pro", "brand-cog"],
      escalationLevel: "specialist",
    },
  },
  "simons": {
    role: "data-analysis",
    description: "Data Analysis & Quantitative Strategy",
    personaStyle: "Numbers-driven, precise. Evidence-based.",
    openclawSessionKey: "agent:simons:main",
    runtime: { claudeTier: "opus" },
    declared: {
      provider: "claude-max",
      model: "claude-opus-4-6",
      capabilities: ["data-analysis", "quantitative-reasoning"],
      skills: ["data-visualization", "ga4-analytics"],
      escalationLevel: "specialist",
    },
  },
  "mercury": {
    role: "sales",
    description: "Sales Strategy & Revenue",
    personaStyle: "Persuasive, results-oriented. Revenue-focused.",
    openclawSessionKey: "agent:mercury:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["sales-strategy", "pricing", "revenue-modeling"],
      skills: ["marketing-mode", "competitive-analysis"],
      escalationLevel: "specialist",
    },
  },
  "vee": {
    role: "brand-strategy",
    description: "Brand Strategy & Marketing",
    personaStyle: "Brand-aware, strategic. Audience-first thinking.",
    openclawSessionKey: "agent:vee:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "openrouter",
      model: "kimi-k2.5",
      capabilities: ["brand-strategy", "positioning", "visual-direction"],
      skills: ["ui-ux-pro-max", "nano-banana-pro", "brand-analyzer"],
      escalationLevel: "specialist",
    },
  },
  "ink": {
    role: "copywriting",
    description: "Copywriting & Content Creation",
    personaStyle: "Creative writer, concise. Words matter.",
    openclawSessionKey: "agent:ink:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["copywriting", "content-generation", "social-content"],
      skills: ["nano-banana-pro", "marketing-mode"],
      escalationLevel: "executor",
    },
  },
  "echo": {
    role: "community",
    description: "Community Engagement & Social",
    personaStyle: "Friendly, community-minded. Engagement-focused.",
    openclawSessionKey: "agent:echo:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "ollama",
      model: "qwen3:14b",
      capabilities: ["community-engagement", "social-interaction"],
      skills: ["marketing-mode"],
      escalationLevel: "specialist",
      providerNote: "Local M5 MacBook",
    },
  },
  "haven": {
    role: "support",
    description: "Support & Client Onboarding",
    personaStyle: "Warm, helpful, patient. Customer success.",
    openclawSessionKey: "agent:haven:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["support-automation", "onboarding", "client-experience"],
      skills: ["ui-ux-pro-max"],
      escalationLevel: "executor",
    },
  },
  "widow": {
    role: "security",
    description: "Cybersecurity & Threat Analysis",
    personaStyle: "Vigilant, security-first. Trust nothing.",
    openclawSessionKey: "agent:widow:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "ollama",
      model: "qwen3:14b",
      capabilities: ["vulnerability-scanning", "security-checks"],
      skills: ["healthcheck", "dns-networking"],
      escalationLevel: "specialist",
      providerNote: "Local M5 MacBook",
    },
  },
  "drstrange": {
    role: "forecasting",
    description: "Strategic Forecasting & Scenarios",
    personaStyle: "Forward-looking, probabilistic. Maps futures.",
    openclawSessionKey: "agent:strange:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["scenario-modeling", "strategic-forecasting"],
      skills: ["competitive-analysis", "business-plan"],
      escalationLevel: "specialist",
    },
  },
  "kiyosaki": {
    role: "finance",
    description: "Financial Strategy & Capital",
    personaStyle: "Wealth-minded, asset-focused. Cash flow thinking.",
    openclawSessionKey: "agent:kiyosaki:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["financial-analysis", "capital-strategy"],
      skills: ["intellectia-stock-forecast", "invoice-generator"],
      escalationLevel: "specialist",
    },
  },
  "michael": {
    role: "swim-coaching",
    description: "Swim Coaching & Athlete Development",
    personaStyle: "Motivating, technical. Performance-driven.",
    openclawSessionKey: "agent:swimelite:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "ollama",
      model: "qwen3:14b",
      capabilities: ["swim-coaching", "race-strategy"],
      skills: ["data-visualization"],
      escalationLevel: "specialist",
      providerNote: "Local M5 MacBook",
    },
  },
  "selah": {
    role: "psychology",
    description: "Psychology & Wellness",
    personaStyle: "Empathetic, insightful. Mental performance.",
    openclawSessionKey: "agent:selah:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "ollama",
      model: "qwen3:14b",
      capabilities: ["psychology", "mental-performance"],
      skills: ["focus-deep-work", "habit-tracker"],
      escalationLevel: "specialist",
      providerNote: "Local M5 MacBook",
    },
  },
  "prophets": {
    role: "spiritual",
    description: "Spiritual Counsel & Wisdom",
    personaStyle: "Thoughtful, grounded in faith. Purpose-driven.",
    openclawSessionKey: "agent:prophets:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "ollama",
      model: "qwen3:14b",
      capabilities: ["spiritual-counsel", "wisdom"],
      skills: ["oracle"],
      escalationLevel: "specialist",
      providerNote: "Local M5 MacBook",
    },
  },
  "themaestro": {
    role: "music",
    description: "Music Production & Audio",
    personaStyle: "Creative, technical. Sound-obsessed.",
    openclawSessionKey: "agent:maestro:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "ollama",
      model: "qwen3:14b",
      capabilities: ["music-production"],
      skills: ["ai-music-generation", "songsee", "clawtunes"],
      escalationLevel: "executor",
      providerNote: "Local M5 MacBook",
    },
  },
  "nova": {
    role: "fabrication",
    description: "3D Fabrication & Overnight Builds",
    personaStyle: "Maker mindset, iterative. Build-test-iterate.",
    openclawSessionKey: "agent:nova:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["prototyping", "3d-design", "overnight-builds", "ui-prototyping"],
      skills: ["ui-ux-pro-max", "nano-banana-pro", "coding-agent"],
      escalationLevel: "executor",
    },
  },
  "themis": {
    role: "governance",
    description: "Legal, Governance & Compliance",
    personaStyle: "Precise, careful. Risk-aware.",
    openclawSessionKey: "agent:themis:main",
    runtime: { claudeTier: "sonnet" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["rule-enforcement", "token-discipline", "protocol-audit", "security-auditing", "legal-counsel"],
      skills: ["cron-health", "agent-dashboard", "healthcheck", "github"],
      escalationLevel: "authority",
    },
  },
};

/** Full record = client-safe core joined with server details by id. Throws on any mismatch (fail loud). */
export const AGENT_REGISTRY: readonly AgentDefinition[] = (() => {
  const coreIds = new Set(AGENT_CORE.map((c) => c.id));
  for (const id of Object.keys(AGENT_SERVER_DETAILS)) {
    if (!coreIds.has(id)) throw new Error(`agent-registry: server details for unknown core id "${id}"`);
  }
  return AGENT_CORE.map((c) => {
    const d = AGENT_SERVER_DETAILS[c.id];
    if (!d) throw new Error(`agent-registry: core agent "${c.id}" has no server details`);
    return { ...c, ...d };
  });
})();


/* ── Lookups ─────────────────────────────────────────────────────────── */

const norm = (s: string): string => String(s).toLowerCase().trim();

const BY_KEY: ReadonlyMap<string, AgentDefinition> = (() => {
  const m = new Map<string, AgentDefinition>();
  for (const a of AGENT_REGISTRY) {
    for (const k of [a.id, a.directoryId, ...a.aliases]) m.set(norm(k), a);
  }
  return m;
})();

/** Resolve an id, directory id or alias (case-insensitive). Unknown -> undefined. */
export function getAgent(idOrAlias: string): AgentDefinition | undefined {
  return BY_KEY.get(norm(idOrAlias));
}

export function listAgents(filter?: { channel?: AgentChannel; status?: "active" | "inactive" }): AgentDefinition[] {
  return AGENT_REGISTRY.filter(
    (a) =>
      (!filter?.channel || a.channels.includes(filter.channel)) &&
      (!filter?.status || a.status === filter.status),
  );
}

/* ── Derived views (replace the old hand-written tables) ─────────────── */

/** short id -> OpenClaw session key (agents with a known key). */
export function openclawSessionKeyMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of AGENT_REGISTRY) if (a.openclawSessionKey) out[a.id] = a.openclawSessionKey;
  return out;
}

/** short id -> Claude tier for chat agents. Agents with an unknown tier are omitted. */
export function claudeTierMap(): Record<string, ClaudeTier> {
  const out: Record<string, ClaudeTier> = {};
  for (const a of AGENT_REGISTRY) {
    if (a.channels.includes("cc-chat") && a.runtime.claudeTier !== "unknown") out[a.id] = a.runtime.claudeTier;
  }
  return out;
}

/** short id -> persona used to build chat system prompts. */
export function personaMap(): Record<string, { role: string; style: string }> {
  const out: Record<string, { role: string; style: string }> = {};
  for (const a of AGENT_REGISTRY) {
    if (a.channels.includes("cc-chat") && a.personaStyle) out[a.id] = { role: a.description, style: a.personaStyle };
  }
  return out;
}

export interface DirectoryAgentShape {
  model: string;
  provider: string;
  role: string;
  capabilities?: string[];
  skills?: string[];
  escalation_level?: string;
  provider_note?: string;
}

/** directoryId -> directory.json-shaped record (the static roster fallback). */
export function directoryAgents(): Record<string, DirectoryAgentShape> {
  const out: Record<string, DirectoryAgentShape> = {};
  for (const a of AGENT_REGISTRY) {
    const d = a.declared;
    const rec: DirectoryAgentShape = {
      model: d.model,
      provider: d.provider,
      role: a.role,
      capabilities: [...d.capabilities],
    };
    if (d.skills) rec.skills = [...d.skills];
    rec.escalation_level = d.escalationLevel;
    if (d.providerNote) rec.provider_note = d.providerNote;
    out[a.directoryId] = rec;
  }
  return out;
}

/* ── Truth gap report ────────────────────────────────────────────────── */

export interface DeclaredVsRuntime {
  id: string;
  declaredProvider: string;
  declaredModel: string;
  runtimeTier: ClaudeTier | "unknown";
  /**
   * Whether the declared model is a Claude model of the same TIER FAMILY as the runtime tier.
   * "unknown" when the runtime tier is unknown. This is deliberately coarse: `true` does NOT mean
   * the model versions match (declared is claude-sonnet-4-5-*, the runtime default is claude-sonnet-4-6).
   */
  sameClaudeFamily: boolean | "unknown";
}

/**
 * Compare the declared directory model with the claude-max chat tier the code uses.
 * This is evidence of the UI/runtime gap, not a routing input.
 */
export function declaredVsRuntime(): DeclaredVsRuntime[] {
  return AGENT_REGISTRY.map((a) => {
    const tier = a.runtime.claudeTier;
    const m = a.declared.model.toLowerCase();
    return {
      id: a.id,
      declaredProvider: a.declared.provider,
      declaredModel: a.declared.model,
      runtimeTier: tier,
      sameClaudeFamily: tier === "unknown" ? "unknown" : m.includes("claude") && m.includes(tier),
    };
  });
}
