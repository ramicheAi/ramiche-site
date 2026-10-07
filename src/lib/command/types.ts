/**
 * P06 M5: Universal Command shadow routing, the shared (client-safe) vocabulary.
 *
 * A shadow decision records which handler WOULD take a founder command. Nothing is executed, sent, approved, merged
 * or deployed by producing one. A handler's provider is the Provider Adapter id it would run through, or null for an
 * external tool the adapter does not drive. This file is client-safe, so it may not import the adapter (not even its
 * types); service.ts checks at compile time that every id here is a real adapter ProviderId.
 */
export type CommandProvider = "claude-max" | "openclaw";

export const HANDLERS = [
  "claude_code", "claude_chat", "chatgpt", "codex_review", "perplexity", "openclaw", "cockpit_agent", "human", "existing_job", "no_action",
] as const;
export type Handler = (typeof HANDLERS)[number];

export const HANDLER_META: Record<Handler, { label: string; provider: CommandProvider | null; note: string }> = {
  claude_code: { label: "Claude Code", provider: null, note: "repository implementation" },
  claude_chat: { label: "Claude (chat)", provider: "claude-max", note: "conversation through the Provider Adapter" },
  chatgpt: { label: "ChatGPT", provider: null, note: "external tool, not driven by the Provider Adapter" },
  codex_review: { label: "Codex review", provider: null, note: "code review" },
  perplexity: { label: "Perplexity", provider: null, note: "current-web research" },
  openclaw: { label: "OpenClaw", provider: "openclaw", note: "fleet gateway through the Provider Adapter" },
  cockpit_agent: { label: "Cockpit agent", provider: "claude-max", note: "a registry agent in cockpit chat" },
  human: { label: "Founder", provider: null, note: "a founder decision; never delegated" },
  existing_job: { label: "Existing job", provider: null, note: "work already tracked as a job" },
  no_action: { label: "No action", provider: null, note: "nothing to route" },
};

/**
 * How the route was decided. Coarse on purpose: no numeric confidence.
 *   explicit       the founder named the handler (in the text, or by editing the routing)
 *   deterministic  a fixed rule matched
 *   ambiguous      no rule decided it; a question is returned instead of a guess
 * There is no classifier in M5, so no decision is ever model-derived.
 */
export type RouteSource = "explicit" | "deterministic" | "ambiguous";

export type ShadowDecision = {
  intent: "founder_authority" | "security_decision" | "implementation" | "analysis" | "review" | "research" | "conversation" | "job_reference" | "agent_task" | "nothing" | "unclear";
  handler: Handler | null;
  /** registry agent id when handler is cockpit_agent */
  agentId: string | null;
  provider: CommandProvider | null;
  reviewer: Handler | null;
  /** M5 never grants merge or deploy authority to anyone but the founder. */
  mergeAuthority: "founder";
  missionRecommended: boolean;
  attachRecommended: boolean;
  founderApprovalRequired: boolean;
  reviewRequired: boolean;
  source: RouteSource;
  reasons: string[];
  question: string | null;
  /** Always null in M5: no model or classifier is consulted. */
  classifier: null;
  /** job id when handler is existing_job */
  jobId: string | null;
};

/** What is stored with the command (messages.metadata) and returned to the founder. */
export type ShadowRecord = {
  id: string;
  command: string;
  routedAt: string;
  routerVersion: string;
  shadow: true;
  executed: false;
  missionContext: string | null;
  supersedes: string | null;
  decision: ShadowDecision;
  /** Missions that link this command (live links), read from mission_links on every read. */
  linkedMissions: { id: string; ref: number; state: string; relation: string }[];
};

export const SHADOW_KIND = "universal_command_shadow";
export const COMMAND_CHANNEL_SLUG = "universal-command";
export const ROUTER_VERSION = "m5-rules-1";
