/**
 * P06 M5: the Universal Command shadow router. One pure, deterministic function: text in, decision out.
 * It never calls a model, a provider, the network, or the database, and it executes nothing.
 *
 * Order (first match decides the handler):
 *   1. SAFETY  a founder-authority or security decision is always the founder's (handler "human"). This outranks an
 *              explicit handler, so "Claude Code, approve the PR" or "Codex, rotate the API key" is never delegated.
 *   2. EXPLICIT  the founder named a handler: an edit of the routing, or a name in the text (Claude Code, Codex,
 *              ChatGPT, Perplexity, OpenClaw, Claude, @agent from the canonical registry).
 *   3. DETERMINISTIC  fixed keyword rules: job reference, review-only, current-web research, repository work, chatter.
 *   4. CONTEXT  a Mission context never picks a handler; it only turns "create a mission" into "attach to this one".
 *   5. AMBIGUOUS  otherwise no handler is chosen and a question is returned. There is no classifier in M5.
 */
import { AGENT_CORE } from "@/lib/agent-registry-core";
import { HANDLER_META, HANDLERS, type Handler, type ShadowDecision } from "./types";

export type RouteInput = {
  text: string;
  /** a handler the founder picked by editing the routing */
  handlerHint?: Handler | null;
  /** the Mission the command was issued from, already verified to exist in the tenant */
  missionId?: string | null;
};

const ACTIVE_AGENTS = new Map(AGENT_CORE.filter((a) => a.status === "active").flatMap((a) => [[a.id, a.id], ...a.aliases.map((x) => [x, a.id])] as [string, string][]));

/* ── safety: never delegated, never classified ──────────────────────────────────────────────────────────── */
// A command whose leading verb is a founder decision. Negated constraints ("don't merge without me") are not leading.
const AUTHORITY_VERB = /^(?:(?:please|ok|okay|go ahead and|now)\s+)*(approve|reject|merge|deploy|release|publish|verify|cancel|delete|remove|pay|refund|sign|accept|ship)\b/;
// A security or authorization decision anywhere in the command.
const SECURITY = /\b(grant|revoke|rotate|reset)\b[^.!?\n]{0,40}\b(access|permission|permissions|role|roles|admin|authority|key|keys|secret|secrets|token|tokens|credential|credentials|password|passwords)\b|\b(api key|secret key|access token|service[_ -]role|credentials?|password)\b/;

/* ── explicit names ─────────────────────────────────────────────────────────────────────────────────────── */
const NAMED: { handler: Handler; re: RegExp }[] = [
  { handler: "claude_code", re: /\bclaude[ -]?code\b/g },
  { handler: "codex_review", re: /\bcodex\b/g },
  { handler: "chatgpt", re: /\b(?:chat ?gpt|gpt-?\d[\w.]*|openai)\b/g },
  { handler: "perplexity", re: /\bperplexity\b/g },
  { handler: "openclaw", re: /\bopen ?claw\b/g },
  { handler: "claude_chat", re: /\bclaude\b(?![ -]?code)/g },
];
const REVIEW_WORD = /\b(review|reviews|reviewing|reviewer|audit|audits|check|checks)\b/;

/* ── deterministic rules ────────────────────────────────────────────────────────────────────────────────── */
const JOB_REF = /\bjob\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/;
const REVIEW_ONLY = /^(?:please\s+)?(review|audit|code review)\b|\breview (?:this|the|my) (?:pr|pull request|diff|change|changes|code|branch|commit)\b/;
const RESEARCH = /^(?:please\s+)?(research|look up|find out|search for|compare)\b|\b(latest|current|recent|today'?s|news|competitor|competitors|pricing|market rate)\b/;
const IMPLEMENT = /^(?:please\s+)?(fix|implement|build|refactor|debug|add|write|update|migrate|create|wire|patch)\b/;
const CHATTER = /^(hi|hello|hey|thanks|thank you|ok|okay|cool|nice|got it)[.! ]*$/;
const NO_MERGE = /\b(?:don'?t|do not|never|no)\s+merge\b|\bwithout me\b/;

const WORK: ReadonlySet<Handler> = new Set<Handler>(["claude_code", "openclaw", "existing_job", "cockpit_agent"]);
const NEEDS_FOUNDER: ReadonlySet<Handler> = new Set<Handler>(["claude_code", "openclaw", "existing_job", "cockpit_agent", "human", "codex_review"]);

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/** Every handler named in the text, in order of appearance, each tagged as a doer or a reviewer by its own sentence. */
function namedHandlers(t: string): { handler: Handler; at: number; reviewer: boolean; agentId: string | null }[] {
  const out: { handler: Handler; at: number; reviewer: boolean; agentId: string | null }[] = [];
  const sentenceAt = (i: number) => {
    const start = Math.max(t.lastIndexOf(".", i - 1), t.lastIndexOf("!", i - 1), t.lastIndexOf("?", i - 1), t.lastIndexOf("\n", i - 1)) + 1;
    const ends = [".", "!", "?", "\n"].map((c) => t.indexOf(c, i)).filter((x) => x >= 0);
    return t.slice(start, ends.length ? Math.min(...ends) : t.length);
  };
  for (const { handler, re } of NAMED) {
    for (const m of t.matchAll(re)) {
      const sentence = sentenceAt(m.index ?? 0);
      out.push({ handler, at: m.index ?? 0, reviewer: handler === "codex_review" || REVIEW_WORD.test(sentence), agentId: null });
    }
  }
  for (const m of t.matchAll(/@([a-z][a-z0-9_-]*)/g)) {
    const id = ACTIVE_AGENTS.get(m[1]);
    if (id) out.push({ handler: "cockpit_agent", at: m.index ?? 0, reviewer: REVIEW_WORD.test(sentenceAt(m.index ?? 0)), agentId: id });
  }
  return out.sort((a, b) => a.at - b.at);
}

function decide(over: Partial<ShadowDecision> & Pick<ShadowDecision, "intent" | "handler" | "source" | "reasons">, t: string, inMission: boolean): ShadowDecision {
  const handler = over.handler;
  const reviewer = over.reviewer ?? null;
  const work = handler !== null && WORK.has(handler);
  const reasons = [...over.reasons];
  if (NO_MERGE.test(t)) reasons.push("founder_keeps_merge_authority");
  if (inMission) reasons.push("issued_inside_mission");
  return {
    intent: over.intent,
    handler,
    agentId: over.agentId ?? null,
    provider: handler ? HANDLER_META[handler].provider : null,
    reviewer,
    mergeAuthority: "founder",
    missionRecommended: !inMission && (work || reviewer !== null),
    attachRecommended: inMission && handler !== null && handler !== "no_action",
    founderApprovalRequired: handler !== null && NEEDS_FOUNDER.has(handler),
    reviewRequired: reviewer !== null || handler === "claude_code" || handler === "openclaw",
    source: over.source,
    reasons,
    question: over.question ?? null,
    classifier: null,
    jobId: over.jobId ?? null,
  };
}

export function routeCommand(input: RouteInput): ShadowDecision {
  const t = norm(input.text);
  const inMission = Boolean(input.missionId);

  // 1. safety
  if (AUTHORITY_VERB.test(t)) return decide({ intent: "founder_authority", handler: "human", source: "deterministic", reasons: ["founder_authority_verb"] }, t, inMission);
  if (SECURITY.test(t)) return decide({ intent: "security_decision", handler: "human", source: "deterministic", reasons: ["security_or_authorization"] }, t, inMission);

  // 2. explicit
  const named = namedHandlers(t);
  if (input.handlerHint) {
    const reviewer = named.find((n) => n.reviewer && n.handler !== input.handlerHint)?.handler ?? null;
    return decide({ intent: intentOf(input.handlerHint), handler: input.handlerHint, reviewer, source: "explicit", reasons: ["founder_edited_routing"] }, t, inMission);
  }
  if (named.length) {
    const doer = named.find((n) => !n.reviewer);
    const primary = doer ?? named[0];
    const reviewer = named.find((n) => n.reviewer && n !== primary)?.handler ?? null;
    const reasons = [`named_${primary.handler}`, ...(reviewer ? [`named_reviewer_${reviewer}`] : [])];
    return decide({ intent: doer ? intentOf(primary.handler) : "review", handler: primary.handler, agentId: primary.agentId, reviewer, source: "explicit", reasons }, t, inMission);
  }

  // 3. deterministic
  const job = JOB_REF.exec(t);
  if (job) return decide({ intent: "job_reference", handler: "existing_job", jobId: job[1], source: "deterministic", reasons: ["job_reference"] }, t, inMission);
  if (CHATTER.test(t)) return decide({ intent: "nothing", handler: "no_action", source: "deterministic", reasons: ["no_instruction"] }, t, inMission);
  if (REVIEW_ONLY.test(t)) return decide({ intent: "review", handler: "codex_review", source: "deterministic", reasons: ["review_only"] }, t, inMission);
  if (RESEARCH.test(t)) return decide({ intent: "research", handler: "perplexity", source: "deterministic", reasons: ["current_web_research"] }, t, inMission);
  if (IMPLEMENT.test(t)) return decide({ intent: "implementation", handler: "claude_code", source: "deterministic", reasons: ["repository_work"] }, t, inMission);

  // 4/5. context never decides; ask
  return decide({
    intent: "unclear", handler: null, source: "ambiguous", reasons: ["no_rule_matched"],
    question: "Who should take this? Name a handler (for example Claude Code, Codex, Perplexity, OpenClaw or an @agent), or pick one under Edit routing.",
  }, t, inMission);
}

function intentOf(h: Handler): ShadowDecision["intent"] {
  switch (h) {
    case "claude_code": case "openclaw": return "implementation";
    case "codex_review": return "review";
    case "perplexity": return "research";
    case "claude_chat": case "chatgpt": return "conversation";
    case "cockpit_agent": return "agent_task";
    case "human": return "founder_authority";
    case "existing_job": return "job_reference";
    case "no_action": return "nothing";
  }
}

export const isHandler = (v: unknown): v is Handler => typeof v === "string" && (HANDLERS as readonly string[]).includes(v);
