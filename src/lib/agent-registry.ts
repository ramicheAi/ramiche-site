/**
 * Canonical agent registry (P06 Packet 1): one record per agent identity.
 *
 * Every surface that needs an agent's id, DM UUID, OpenClaw session key, Claude
 * tier, persona or directory metadata should derive it from here through the
 * selectors below, never from a hand-written table.
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
 */

export type ClaudeTier = "opus" | "sonnet" | "haiku";
export type AgentChannel = "cc-chat";

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

export interface AgentDefinition {
  /** Canonical, chat-safe id. Matches chat routing, DM UUIDs and the OpenClaw gateway. */
  readonly id: string;
  /** Key used by /api/command-center/agents and the export (differs only for Dr Strange). */
  readonly directoryId: string;
  readonly aliases: readonly string[];
  readonly name: string;
  /** Role slug as served by the roster API. */
  readonly role: string;
  readonly description: string;
  readonly personaStyle: string | null;
  readonly status: "active" | "inactive";
  /** Where this agent can be addressed. Empty = not addressable in chat. */
  readonly channels: readonly AgentChannel[];
  readonly dmUuid: string | null;
  /** OpenClaw session key (backend/adapter target); null = none known. */
  readonly openclawSessionKey: string | null;
  readonly runtime: { readonly claudeTier: ClaudeTier | "unknown" };
  readonly declared: AgentDeclared;
}

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    id: "archivist",
    directoryId: "archivist",
    aliases: [],
    name: "Archivist",
    role: "workspace-indexer",
    description: "Workspace indexer: file lookup, route mapping, codebase queries",
    personaStyle: null,
    status: "active",
    channels: [],
    dmUuid: null,
    openclawSessionKey: null,
    runtime: { claudeTier: "unknown" },
    declared: {
      provider: "claude-max",
      model: "claude-sonnet-4-5-20250929",
      capabilities: ["file-lookup", "route-mapping", "codebase-queries"],
      escalationLevel: "level-0",
    },
  },
  {
    id: "atlas",
    directoryId: "atlas",
    aliases: [],
    name: "Atlas",
    role: "operations-lead",
    description: "Operations Lead & Strategic Command",
    personaStyle: "Calm, sharp, direct. Systems thinker.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000001-0000-0000-0000-000000000000",
    openclawSessionKey: "agent:main:main",
    runtime: { claudeTier: "opus" },
    declared: {
      provider: "claude-max",
      model: "claude-opus-4-6",
      capabilities: ["planning", "delegation", "review", "orchestration"],
      escalationLevel: "final",
    },
  },
  {
    id: "triage",
    directoryId: "triage",
    aliases: [],
    name: "Triage",
    role: "debugging",
    description: "Debugging & Log Analysis",
    personaStyle: "Methodical, detail-oriented. Asks clarifying questions.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000002-0000-0000-0000-000000000000",
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
  {
    id: "shuri",
    directoryId: "shuri",
    aliases: [],
    name: "Shuri",
    role: "engineering",
    description: "Frontend Engineering & Code Generation",
    personaStyle: "Fast-moving, practical. Code-first answers.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000003-0000-0000-0000-000000000000",
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
  {
    id: "proximon",
    directoryId: "proximon",
    aliases: [],
    name: "Proximon",
    role: "architecture",
    description: "Systems Architecture & Infrastructure",
    personaStyle: "Thoughtful, architectural. Considers scale.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000004-0000-0000-0000-000000000000",
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
  {
    id: "aetherion",
    directoryId: "aetherion",
    aliases: [],
    name: "Aetherion",
    role: "creative-director",
    description: "Creative Director & Visual Design",
    personaStyle: "Visionary, aesthetic-focused. Thinks in imagery.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000005-0000-0000-0000-000000000000",
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
  {
    id: "simons",
    directoryId: "simons",
    aliases: [],
    name: "Simons",
    role: "data-analysis",
    description: "Data Analysis & Quantitative Strategy",
    personaStyle: "Numbers-driven, precise. Evidence-based.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000006-0000-0000-0000-000000000000",
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
  {
    id: "mercury",
    directoryId: "mercury",
    aliases: [],
    name: "Mercury",
    role: "sales",
    description: "Sales Strategy & Revenue",
    personaStyle: "Persuasive, results-oriented. Revenue-focused.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000007-0000-0000-0000-000000000000",
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
  {
    id: "vee",
    directoryId: "vee",
    aliases: [],
    name: "Vee",
    role: "brand-strategy",
    description: "Brand Strategy & Marketing",
    personaStyle: "Brand-aware, strategic. Audience-first thinking.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000008-0000-0000-0000-000000000000",
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
  {
    id: "ink",
    directoryId: "ink",
    aliases: [],
    name: "Ink",
    role: "copywriting",
    description: "Copywriting & Content Creation",
    personaStyle: "Creative writer, concise. Words matter.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000009-0000-0000-0000-000000000000",
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
  {
    id: "echo",
    directoryId: "echo",
    aliases: [],
    name: "Echo",
    role: "community",
    description: "Community Engagement & Social",
    personaStyle: "Friendly, community-minded. Engagement-focused.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000010-0000-0000-0000-000000000000",
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
  {
    id: "haven",
    directoryId: "haven",
    aliases: [],
    name: "Haven",
    role: "support",
    description: "Support & Client Onboarding",
    personaStyle: "Warm, helpful, patient. Customer success.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000011-0000-0000-0000-000000000000",
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
  {
    id: "widow",
    directoryId: "widow",
    aliases: [],
    name: "Widow",
    role: "security",
    description: "Cybersecurity & Threat Analysis",
    personaStyle: "Vigilant, security-first. Trust nothing.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000012-0000-0000-0000-000000000000",
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
  {
    id: "drstrange",
    directoryId: "dr-strange",
    aliases: ["dr-strange"],
    name: "Dr Strange",
    role: "forecasting",
    description: "Strategic Forecasting & Scenarios",
    personaStyle: "Forward-looking, probabilistic. Maps futures.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000013-0000-0000-0000-000000000000",
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
  {
    id: "kiyosaki",
    directoryId: "kiyosaki",
    aliases: [],
    name: "Kiyosaki",
    role: "finance",
    description: "Financial Strategy & Capital",
    personaStyle: "Wealth-minded, asset-focused. Cash flow thinking.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000014-0000-0000-0000-000000000000",
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
  {
    id: "michael",
    directoryId: "michael",
    aliases: [],
    name: "Michael",
    role: "swim-coaching",
    description: "Swim Coaching & Athlete Development",
    personaStyle: "Motivating, technical. Performance-driven.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000015-0000-0000-0000-000000000000",
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
  {
    id: "selah",
    directoryId: "selah",
    aliases: [],
    name: "Selah",
    role: "psychology",
    description: "Psychology & Wellness",
    personaStyle: "Empathetic, insightful. Mental performance.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000016-0000-0000-0000-000000000000",
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
  {
    id: "prophets",
    directoryId: "prophets",
    aliases: [],
    name: "Prophets",
    role: "spiritual",
    description: "Spiritual Counsel & Wisdom",
    personaStyle: "Thoughtful, grounded in faith. Purpose-driven.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000017-0000-0000-0000-000000000000",
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
  {
    id: "themaestro",
    directoryId: "themaestro",
    aliases: [],
    name: "TheMAESTRO",
    role: "music",
    description: "Music Production & Audio",
    personaStyle: "Creative, technical. Sound-obsessed.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000018-0000-0000-0000-000000000000",
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
  {
    id: "nova",
    directoryId: "nova",
    aliases: [],
    name: "Nova",
    role: "fabrication",
    description: "3D Fabrication & Overnight Builds",
    personaStyle: "Maker mindset, iterative. Build-test-iterate.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000019-0000-0000-0000-000000000000",
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
  {
    id: "themis",
    directoryId: "themis",
    aliases: [],
    name: "Themis",
    role: "governance",
    description: "Legal, Governance & Compliance",
    personaStyle: "Precise, careful. Risk-aware.",
    status: "active",
    channels: ["cc-chat"],
    dmUuid: "aa000020-0000-0000-0000-000000000000",
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
];

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

/** Ids addressable in CC chat, in registry order. */
export function chatAgentIds(): string[] {
  return listAgents({ channel: "cc-chat" }).map((a) => a.id);
}

/** short id -> DM UUID (chat agents only). */
export function agentDmUuidMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of AGENT_REGISTRY) if (a.dmUuid) out[a.id] = a.dmUuid;
  return out;
}

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
