/**
 * Synthesis approval + handoff execution + verifier loop.
 *
 * Pipeline when Ramon clicks "Approve" on a synthesis card:
 *
 *   Phase C  — Dispatch each action.owner with an EXECUTION prompt (not a
 *              plan prompt). The agent is told to produce the deliverable
 *              *in this reply*, not promise future work.
 *
 *   Phase F  — Verifier loop. After each deliverable comes back, Atlas
 *              (acting as critic) reads task + deliverable and emits
 *              { meets_definition, gaps, required_revisions } as JSON. If
 *              the deliverable fails, dispatch the same owner again with
 *              the gaps appended as revision instructions. Cap at
 *              MAX_ATTEMPTS to stay inside the route's maxDuration.
 *
 *   Sequential mode — When plan.execution_mode === "sequential", actions
 *                     run one at a time and a failure halts the chain.
 *                     Default is parallel (Promise.all fan-out).
 *
 * Status flow per action: pending → in_progress → done | blocked.
 * Status is persisted on the synthesis row in metadata.action_statuses
 * so the Decisions UI and chat status pills both see the live state.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  gatewaySessionsSend,
  isOpenClawGatewayConfigured,
  resolveChatSessionKey,
} from "@/lib/openclaw-gateway";
import { AGENT_DM_UUID } from "@/lib/cc-agent-dm-uuids";

export const TENANT_ID = "11111111-1111-1111-1111-111111111111";

/** How many execute→verify attempts per action before flagging blocked. */
const MAX_ATTEMPTS = 2;
/** Wall-clock cap per single LLM dispatch. */
const DISPATCH_TIMEOUT_MS = 60_000;
/** Wall-clock cap per single verifier pass. */
const VERIFIER_TIMEOUT_MS = 30_000;

export type ActionItem = {
  owner: string;
  task: string;
  deliverable?: string;
  due?: string;
};

export type SynthesisPlan = {
  decision: string;
  actions: ActionItem[];
  risks?: string[];
  next_check_in?: string;
  /** "parallel" (default) fan-outs all actions concurrently. "sequential"
   *  runs them one at a time and halts the chain on a blocked action. */
  execution_mode?: "parallel" | "sequential";
};

type ActionStatus = "pending" | "in_progress" | "done" | "blocked" | "cancelled";

type VerifierVerdict = {
  meets_definition: boolean;
  gaps: string[];
  required_revisions: string[];
};

type ExecutionRecord = {
  owner: string;
  task: string;
  status: ActionStatus;
  attempts: number;
  text: string;
  verifier: VerifierVerdict | null;
  via: string | null;
  error?: string;
};

export type ApproveResult =
  | {
      ok: true;
      alreadyApproved?: boolean;
      approvedAt?: string;
      executed?: number;
      blocked?: number;
      total?: number;
      mode?: "parallel" | "sequential";
      results?: Array<{
        owner: string;
        task: string;
        status: ActionStatus;
        attempts: number;
        via: string | null;
        verifierGaps?: string[];
      }>;
    }
  | { ok: false; error: string; status?: number };

/**
 * Live progress events emitted while approveSynthesisMessageStreamed runs.
 * The SSE endpoint at /api/command-center/chat/approve/stream forwards these
 * to the chat UI so action pills can flip pending → in_progress → done
 * in real time without waiting for the whole loop to finish.
 *
 * Order per action (single attempt):
 *   action_start → deliverable → verifying → verdict → action_done
 * Retry case adds an extra action_start (attempt: 2) + deliverable + …
 */
export type ApproveEvent =
  | { type: "plan_loaded"; total: number; mode: "parallel" | "sequential" }
  | { type: "already_approved"; approvedAt: string }
  | {
      type: "action_start";
      actionIndex: number;
      owner: string;
      task: string;
      attempt: number;
    }
  | {
      type: "deliverable";
      actionIndex: number;
      owner: string;
      via: string;
      attempt: number;
      preview: string;
      length: number;
    }
  | { type: "verifying"; actionIndex: number; owner: string }
  | {
      type: "verdict";
      actionIndex: number;
      owner: string;
      meetsDefinition: boolean;
      gaps: string[];
      revisions: string[];
    }
  | {
      type: "action_done";
      actionIndex: number;
      owner: string;
      status: ActionStatus;
      attempts: number;
    }
  | {
      type: "complete";
      executed: number;
      blocked: number;
      total: number;
      mode: "parallel" | "sequential";
    }
  | { type: "error"; error: string };

type OnEvent = (event: ApproveEvent) => void;
const NOOP_EVENT: OnEvent = () => {};

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || undefined;
}

export function getSupabaseServiceForApprove(): SupabaseClient | null {
  const url = cleanEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = cleanEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const AGENT_MODEL_TIER: Record<string, "opus" | "sonnet" | "haiku"> = {
  atlas: "opus",
  themis: "sonnet",
  drstrange: "sonnet",
  simons: "sonnet",
  kiyosaki: "sonnet",
  proximon: "sonnet",
  widow: "sonnet",
  shuri: "sonnet",
  aetherion: "sonnet",
  selah: "sonnet",
  prophets: "sonnet",
  mercury: "sonnet",
  vee: "sonnet",
  ink: "sonnet",
  echo: "sonnet",
  haven: "sonnet",
  michael: "sonnet",
  themaestro: "sonnet",
  nova: "sonnet",
  triage: "haiku",
};

function modelForAgent(agentId: string): string {
  const tier = AGENT_MODEL_TIER[agentId.toLowerCase()] ?? "sonnet";
  if (tier === "opus") return cleanEnv("CC_CLAUDE_MODEL_OPUS") || "claude-opus-4-6";
  if (tier === "sonnet") return cleanEnv("CC_CLAUDE_MODEL_SONNET") || "claude-sonnet-4-6";
  return cleanEnv("CC_CLAUDE_MODEL_HAIKU") || "claude-haiku-4-5";
}

function displayName(agentId: string): string {
  if (!agentId) return "Agent";
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}

/**
 * EXECUTION prompt — demands the deliverable IN this reply, not a future plan.
 *
 * Includes:
 *   - The agent's task + deliverable definition
 *   - Peer list so they know who else is on which thread
 *   - `priorDeliverables`: artifacts shipped by upstream actions in the same
 *     plan. CRITICAL in sequential mode — without this the downstream agent
 *     literally cannot see the work they're supposed to adapt, and they end
 *     up self-blocking with "I need @<upstream>'s output."
 *   - `retryFeedback`: verifier's gaps from the previous attempt so the
 *     owner fixes those specific issues on retry.
 *
 * Formatting rules favor clean narrative over markdown salad — the rendered
 * messages should read like a real teammate's note, not a wiki dump.
 */
function buildExecutionPrompt(
  owner: string,
  action: ActionItem,
  plan: SynthesisPlan,
  channelName: string | undefined,
  retryFeedback: VerifierVerdict | null,
  priorDeliverables: Array<{ owner: string; task: string; text: string }>
): string {
  const name = displayName(owner);
  const peers = plan.actions
    .filter((a) => a.owner.toLowerCase() !== owner.toLowerCase())
    .map((a) => `  - @${a.owner}: ${a.task}${a.due ? ` (by ${a.due})` : ""}`)
    .join("\n");

  // Trim very large deliverables so the prompt stays under context limits.
  // 4000 chars per upstream artifact is enough for tweets / briefs / specs
  // without blowing the budget when 3-4 prior actions stack up.
  const priorBlock =
    priorDeliverables.length > 0
      ? [
          ``,
          `Prior deliverables you can use (already shipped by your teammates in this channel — use them, don't ask for them again):`,
          ``,
          ...priorDeliverables.map((d) => {
            const trimmed =
              d.text.length > 4000 ? d.text.slice(0, 4000) + "\n…[truncated]" : d.text;
            return `=== @${d.owner} — ${d.task} ===\n${trimmed}\n=== end @${d.owner} ===\n`;
          }),
        ].join("\n")
      : "";

  const retryBlock = retryFeedback
    ? [
        ``,
        `PREVIOUS ATTEMPT FELL SHORT. Atlas (your reviewer) flagged:`,
        `Gaps:`,
        ...retryFeedback.gaps.map((g) => `  - ${g}`),
        `Required revisions:`,
        ...retryFeedback.required_revisions.map((r) => `  - ${r}`),
        ``,
        `Produce a corrected version now. Do not repeat the prior text verbatim — fix the specific gaps.`,
      ].join("\n")
    : "";

  return [
    `You are ${name}. Speak in first person as ${name} would — direct, operational, in your own voice. Never break character to describe yourself as an AI; you are simply ${name} on the team.`,
    "",
    `Atlas just approved the plan from a${channelName ? ` ${channelName}` : ""} sync and you have ONE workstream to execute right now:`,
    "",
    `  • Task: ${action.task}`,
    action.deliverable ? `  • Deliverable expected: ${action.deliverable}` : "",
    action.due ? `  • Due: ${action.due}` : "",
    "",
    `Whole-team decision: ${plan.decision}`,
    "",
    peers
      ? `Other people running pieces in parallel (so you know who to coordinate with):\n${peers}`
      : "",
    plan.risks && plan.risks.length > 0
      ? `\nRisks the room flagged:\n${plan.risks.map((r) => `  - ${r}`).join("\n")}`
      : "",
    priorBlock,
    retryBlock,
    "",
    `EXECUTE NOW — DO NOT PLAN FOR LATER:`,
    `  - Produce the actual deliverable IN THIS REPLY. If it's a doc, write the doc. If it's specs, write the specs. If it's copy, write the copy.`,
    `  - Open with ONE short sentence confirming what you're shipping. Then a blank line. Then the artifact.`,
    `  - Do NOT say "I will" or "tomorrow" or "by EOD." You are doing it now in this message.`,
    `  - If you genuinely cannot produce the deliverable in this reply because you need information only a teammate has, output a single line: "[BLOCKED: <one-sentence reason and who you need>]" and nothing else. Use this sparingly — only when it's a true hard block. If a prior deliverable is included above, you have what you need.`,
    "",
    `FORMATTING — your reply will be rendered as MARKDOWN in a chat client. Write for fast reading:`,
    `  - Open with ONE short narrative sentence (max 15 words), then a blank line, then structure.`,
    `  - Use real markdown headings for sections — write "## Section name" on its own line. Do NOT use "**LABEL:**" as a fake header (it renders weirdly and breaks scanning).`,
    `  - For sequenced items (tweets, slides, days, steps), use numbered lists with blank lines between: "1. Hook\\n\\n2. Problem\\n\\n3. …". Each item gets its own line; don't smush them into a paragraph.`,
    `  - For non-sequenced lists (channels, owners, risks), use "- " bullets with blank lines between items if items are long.`,
    `  - For code, specs, or JSON, wrap in triple-backtick fenced blocks with a language hint.`,
    `  - Always put a BLANK LINE between paragraphs, between sections, and before each list. Whitespace is the single most important readability tool.`,
    `  - Use **bold** sparingly for emphasis on a key noun inside a sentence. Don't use it to mark up entire labels.`,
    `  - Skip emoji unless they're part of the deliverable's voice (e.g. emoji ARE part of a tweet's copy).`,
    `  - Talk like yourself. Narrative over markdown salad.`,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
}

/**
 * VERIFIER prompt — Atlas reads the deliverable and decides whether it
 * actually meets the task definition. Returns a strict JSON verdict.
 */
function buildVerifierPrompt(action: ActionItem, deliverable: string): string {
  return [
    `You are Atlas, the operations lead. You dispatched a task to a teammate and they returned a deliverable. Be ruthless but specific.`,
    ``,
    `Task: ${action.task}`,
    `Deliverable required: ${action.deliverable || "a usable artifact for the task above (doc, spec, copy, tracker, etc.) — NOT a plan or promise"}`,
    `Owner: @${action.owner}`,
    ``,
    `Owner's output:`,
    `"""`,
    deliverable.slice(0, 6000),
    `"""`,
    ``,
    `Judge it. Two questions:`,
    `  1. Does this PRODUCE the artifact, or is it just a plan / promise / acknowledgment? Promises like "tomorrow I will" or "by EOD" automatically fail unless the artifact is also included.`,
    `  2. If it produces an artifact, is the artifact COMPLETE enough that the owner could hand it off and move on? Or are there material gaps?`,
    ``,
    `Reply ONLY with this exact JSON, nothing before or after:`,
    `{"meets_definition": true|false, "gaps": ["short bullet …"], "required_revisions": ["specific change …"]}`,
    ``,
    `If meets_definition is true, gaps and required_revisions should be empty arrays.`,
    `If false, list 1-3 concrete gaps and 1-3 specific revisions.`,
  ].join("\n");
}

async function callClaudeMax(
  systemPrompt: string,
  userTurn: string,
  model: string,
  timeoutMs: number
): Promise<string | null> {
  const claudeUrl = cleanEnv("CLAUDE_MAX_PROXY_URL") || "http://127.0.0.1:3456/v1/chat/completions";
  const claudeToken = cleanEnv("CLAUDE_MAX_PROXY_TOKEN") || "not-needed";
  try {
    const res = await fetch(claudeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${claudeToken}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userTurn },
        ],
        max_tokens: 1500,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

async function callLMStudio(
  systemPrompt: string,
  userTurn: string,
  timeoutMs: number
): Promise<string | null> {
  const lmUrl = cleanEnv("LM_STUDIO_URL") || "http://127.0.0.1:1234/v1/chat/completions";
  try {
    const res = await fetch(lmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userTurn },
        ],
        max_tokens: 1500,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

/** Dispatch a prompt to the owner agent. Returns the agent's text + which backend served it. */
async function dispatchExecution(
  owner: string,
  prompt: string
): Promise<
  | { ok: true; text: string; via: "openclaw" | "claude-max" | "lm-studio" }
  | { ok: false; error: string }
> {
  const openclawPrimary =
    process.env.OPENCLAW_CHAT_PRIMARY === "1" ||
    process.env.OPENCLAW_CHAT_PRIMARY === "true";
  if (openclawPrimary && isOpenClawGatewayConfigured()) {
    const sessionKey = resolveChatSessionKey(owner);
    const gw = await gatewaySessionsSend(sessionKey, prompt, 90);
    if (gw.ok && gw.reply) return { ok: true, text: gw.reply, via: "openclaw" };
  }

  const claudeText = await callClaudeMax(
    prompt,
    "Execute the task now and produce the deliverable.",
    modelForAgent(owner),
    DISPATCH_TIMEOUT_MS
  );
  if (claudeText && claudeText.trim()) return { ok: true, text: claudeText, via: "claude-max" };

  const lmText = await callLMStudio(
    prompt,
    "Execute the task now and produce the deliverable.",
    DISPATCH_TIMEOUT_MS + 15_000
  );
  if (lmText && lmText.trim()) return { ok: true, text: lmText, via: "lm-studio" };

  return { ok: false, error: "no chat backend responded for handoff" };
}

/** Detect the owner self-flagging a hard block in the deliverable. */
function isOwnerBlocked(text: string): { blocked: true; reason: string } | { blocked: false } {
  const m = text.match(/^\s*\[BLOCKED:\s*([^\]]+)\]\s*$/im);
  if (m) return { blocked: true, reason: m[1].trim() };
  return { blocked: false };
}

/** Critic pass. Returns a parsed verdict or null when the critic itself couldn't run. */
async function runVerifier(
  action: ActionItem,
  deliverable: string
): Promise<VerifierVerdict | null> {
  const prompt = buildVerifierPrompt(action, deliverable);
  const text = await callClaudeMax(
    prompt,
    "Return only the JSON verdict.",
    modelForAgent("atlas"),
    VERIFIER_TIMEOUT_MS
  );
  if (!text) return null;
  try {
    // The model may wrap JSON in ```json fences — strip those defensively.
    const cleaned = text
      .replace(/^[\s\S]*?(\{)/, "$1")
      .replace(/(\})[\s\S]*$/, "$1");
    const parsed = JSON.parse(cleaned) as Partial<VerifierVerdict>;
    if (typeof parsed.meets_definition !== "boolean") return null;
    return {
      meets_definition: parsed.meets_definition,
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
      required_revisions: Array.isArray(parsed.required_revisions)
        ? parsed.required_revisions.map(String)
        : [],
    };
  } catch {
    return null;
  }
}

/** Update the `action_statuses` array on the synthesis row. */
async function persistStatus(
  svc: SupabaseClient,
  synthesisRow: { id: string; metadata: Record<string, unknown> | null },
  totalActions: number,
  actionIndex: number,
  status: ActionStatus
): Promise<void> {
  const meta = synthesisRow.metadata ?? {};
  const existing = Array.isArray(meta.action_statuses)
    ? (meta.action_statuses as string[])
    : [];
  const next: ActionStatus[] = [];
  for (let i = 0; i < totalActions; i++) {
    const prior = existing[i];
    next[i] =
      typeof prior === "string" &&
      ["pending", "in_progress", "done", "blocked", "cancelled"].includes(prior)
        ? (prior as ActionStatus)
        : "pending";
  }
  next[actionIndex] = status;
  const updated = {
    ...meta,
    action_statuses: next,
    action_status_updated_at: new Date().toISOString(),
  };
  synthesisRow.metadata = updated;
  await svc.from("messages").update({ metadata: updated }).eq("id", synthesisRow.id);
}

/**
 * Full lifecycle for a single action: dispatch → verify → retry → post → status.
 * Posts intermediate retry attempts as messages too, so Ramon can read the
 * back-and-forth in the channel instead of seeing only the final version.
 */
async function executeAction(
  svc: SupabaseClient,
  channelId: string,
  tenantId: string,
  synthesisRow: { id: string; metadata: Record<string, unknown> | null },
  totalActions: number,
  actionIndex: number,
  action: ActionItem,
  plan: SynthesisPlan,
  channelName: string | undefined,
  onEvent: OnEvent,
  priorDeliverables: Array<{ owner: string; task: string; text: string }>
): Promise<ExecutionRecord> {
  const owner = action.owner.toLowerCase();
  const ownerUUID = AGENT_DM_UUID[owner] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  await persistStatus(svc, synthesisRow, totalActions, actionIndex, "in_progress");

  let lastText = "";
  let lastVia: string | null = null;
  let lastVerdict: VerifierVerdict | null = null;
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    onEvent({ type: "action_start", actionIndex, owner, task: action.task, attempt });
    const prompt = buildExecutionPrompt(
      owner,
      action,
      plan,
      channelName,
      lastVerdict,
      priorDeliverables
    );
    const dispatched = await dispatchExecution(owner, prompt);
    if (!dispatched.ok) {
      await persistStatus(svc, synthesisRow, totalActions, actionIndex, "blocked");
      onEvent({
        type: "action_done",
        actionIndex,
        owner,
        status: "blocked",
        attempts: attempt,
      });
      return {
        owner,
        task: action.task,
        status: "blocked",
        attempts: attempt,
        text: "",
        verifier: lastVerdict,
        via: lastVia,
        error: dispatched.error,
      };
    }
    lastText = dispatched.text.trim();
    lastVia = dispatched.via;
    onEvent({
      type: "deliverable",
      actionIndex,
      owner,
      via: dispatched.via,
      attempt,
      preview: lastText.slice(0, 240),
      length: lastText.length,
    });

    // Persist this attempt as a message so the channel shows the full work,
    // not just the final accepted version. Tag attempts > 1 as revisions.
    await svc.from("messages").insert({
      channel_id: channelId,
      sender_agent_id: ownerUUID,
      sender_type: "agent",
      content: lastText,
      tenant_id: tenantId,
      attachments: [],
      status: "sent",
      metadata: {
        kind: attempt === 1 ? "execution_deliverable" : "execution_revision",
        synthesis_id: synthesisRow.id,
        action_index: actionIndex,
        owner,
        via: dispatched.via,
        attempt,
        task: action.task,
        deliverable: action.deliverable,
        due: action.due,
      },
    });

    // Owner self-flagged a hard block — accept that and stop, don't waste a verifier pass.
    const blocked = isOwnerBlocked(lastText);
    if (blocked.blocked) {
      await persistStatus(svc, synthesisRow, totalActions, actionIndex, "blocked");
      await svc.from("messages").insert({
        channel_id: channelId,
        sender_agent_id: ownerUUID,
        sender_type: "agent",
        content: `⚠ Blocked: ${action.task} — ${blocked.reason}`,
        tenant_id: tenantId,
        attachments: [],
        status: "sent",
        metadata: {
          kind: "task_status",
          synthesis_id: synthesisRow.id,
          action_index: actionIndex,
          new_status: "blocked",
          owner,
        },
      });
      onEvent({
        type: "action_done",
        actionIndex,
        owner,
        status: "blocked",
        attempts: attempt,
      });
      return {
        owner,
        task: action.task,
        status: "blocked",
        attempts: attempt,
        text: lastText,
        verifier: lastVerdict,
        via: lastVia,
      };
    }

    // Verifier pass.
    onEvent({ type: "verifying", actionIndex, owner });
    const verdict = await runVerifier(action, lastText);
    lastVerdict = verdict;
    if (verdict) {
      onEvent({
        type: "verdict",
        actionIndex,
        owner,
        meetsDefinition: verdict.meets_definition,
        gaps: verdict.gaps,
        revisions: verdict.required_revisions,
      });
    } else {
      onEvent({
        type: "verdict",
        actionIndex,
        owner,
        meetsDefinition: true, // accepted optimistically
        gaps: [],
        revisions: [],
      });
    }
    if (!verdict) {
      // Verifier couldn't run (timeout / no backend). Accept the deliverable
      // optimistically — don't punish the owner for our infra failure.
      await persistStatus(svc, synthesisRow, totalActions, actionIndex, "done");
      await svc.from("messages").insert({
        channel_id: channelId,
        sender_agent_id: ownerUUID,
        sender_type: "agent",
        content: `✓ Done: ${action.task} (verifier unavailable — accepted)`,
        tenant_id: tenantId,
        attachments: [],
        status: "sent",
        metadata: {
          kind: "task_status",
          synthesis_id: synthesisRow.id,
          action_index: actionIndex,
          new_status: "done",
          owner,
          verifier: null,
        },
      });
      onEvent({
        type: "action_done",
        actionIndex,
        owner,
        status: "done",
        attempts: attempt,
      });
      return {
        owner,
        task: action.task,
        status: "done",
        attempts: attempt,
        text: lastText,
        verifier: null,
        via: lastVia,
      };
    }

    if (verdict.meets_definition) {
      await persistStatus(svc, synthesisRow, totalActions, actionIndex, "done");
      await svc.from("messages").insert({
        channel_id: channelId,
        sender_agent_id: ownerUUID,
        sender_type: "agent",
        content: `✓ Done: ${action.task}`,
        tenant_id: tenantId,
        attachments: [],
        status: "sent",
        metadata: {
          kind: "task_status",
          synthesis_id: synthesisRow.id,
          action_index: actionIndex,
          new_status: "done",
          owner,
          verifier: verdict,
          attempts: attempt,
        },
      });
      onEvent({
        type: "action_done",
        actionIndex,
        owner,
        status: "done",
        attempts: attempt,
      });
      return {
        owner,
        task: action.task,
        status: "done",
        attempts: attempt,
        text: lastText,
        verifier: verdict,
        via: lastVia,
      };
    }

    // Verifier rejected — loop will retry with feedback if attempts remain.
  }

  // Out of attempts.
  await persistStatus(svc, synthesisRow, totalActions, actionIndex, "blocked");
  const gapsLine =
    lastVerdict && lastVerdict.gaps.length > 0
      ? ` — gaps: ${lastVerdict.gaps.slice(0, 3).join("; ")}`
      : "";
  await svc.from("messages").insert({
    channel_id: channelId,
    sender_agent_id: ownerUUID,
    sender_type: "agent",
    content: `⚠ Blocked: ${action.task} — exhausted ${MAX_ATTEMPTS} attempts${gapsLine}`,
    tenant_id: tenantId,
    attachments: [],
    status: "sent",
    metadata: {
      kind: "task_status",
      synthesis_id: synthesisRow.id,
      action_index: actionIndex,
      new_status: "blocked",
      owner,
      verifier: lastVerdict,
      attempts: MAX_ATTEMPTS,
    },
  });
  onEvent({
    type: "action_done",
    actionIndex,
    owner,
    status: "blocked",
    attempts: MAX_ATTEMPTS,
  });
  return {
    owner,
    task: action.task,
    status: "blocked",
    attempts: MAX_ATTEMPTS,
    text: lastText,
    verifier: lastVerdict,
    via: lastVia,
  };
}

/** Run Phase C+F approval, threading a callback for streaming progress events. */
export async function approveSynthesisMessageStreamed(
  messageId: string,
  onEvent: OnEvent
): Promise<ApproveResult> {
  if (!messageId || !/^[0-9a-f-]{36}$/i.test(messageId)) {
    return { ok: false, error: "messageId required (uuid)", status: 400 };
  }

  const svc = getSupabaseServiceForApprove();
  if (!svc) {
    return { ok: false, error: "Supabase service role not configured", status: 500 };
  }

  const { data: row, error: readErr } = await svc
    .from("messages")
    .select("id, channel_id, content, metadata, sender_agent_id, tenant_id")
    .eq("id", messageId)
    .single();
  if (readErr || !row) {
    return {
      ok: false,
      error: `synthesis message not found: ${readErr?.message || "no row"}`,
      status: 404,
    };
  }

  const meta = (row.metadata as Record<string, unknown> | null) ?? {};
  if (meta.kind !== "synthesis") {
    return { ok: false, error: "message is not a synthesis", status: 400 };
  }
  const plan = meta.plan as SynthesisPlan | undefined;
  if (
    !plan ||
    typeof plan.decision !== "string" ||
    !Array.isArray(plan.actions) ||
    plan.actions.length === 0
  ) {
    return { ok: false, error: "synthesis has no executable plan", status: 400 };
  }

  if (meta.approved_at) {
    const approvedAt = meta.approved_at as string;
    onEvent({ type: "already_approved", approvedAt });
    return { ok: true, alreadyApproved: true, approvedAt };
  }

  const channelId = row.channel_id as string;
  const tenantId = (row.tenant_id as string) || TENANT_ID;
  const channelName = (meta.channel_name as string | undefined) ?? undefined;
  const total = plan.actions.length;
  const mode: "parallel" | "sequential" =
    plan.execution_mode === "sequential" ? "sequential" : "parallel";

  onEvent({ type: "plan_loaded", total, mode });

  // The synthesisRow object is passed-by-reference into executeAction so the
  // .metadata field carries the latest persisted statuses across iterations.
  const synthesisRow = { id: row.id as string, metadata: meta };

  // Backfill priorDeliverables from RECENT channel history so a brand-new
  // synthesis run doesn't dispatch downstream owners blind to artifacts that
  // other agents already shipped in earlier rounds of the same conversation.
  //
  // Without this: Atlas synthesizes a new plan after Ink already shipped a
  // thread two rounds ago. The new plan says "@vee adapt Ink's thread" — but
  // Ink isn't in THIS plan's actions, so my in-run priorDeliverables array
  // never receives it, and Vee gets dispatched with no Ink context and
  // self-blocks. Pulling recent execution_deliverable rows from the channel
  // fixes that loop.
  const channelHistoryBackfill: Array<{
    owner: string;
    task: string;
    text: string;
  }> = await (async () => {
    if (!channelId) return [];
    try {
      const { data } = await svc
        .from("messages")
        .select("content, metadata, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (!data) return [];
      const out: Array<{ owner: string; task: string; text: string }> = [];
      const seen = new Set<string>();
      for (const row of data) {
        const meta = (row.metadata as Record<string, unknown> | null) ?? null;
        if (!meta) continue;
        const kind = meta.kind;
        if (kind !== "execution_deliverable" && kind !== "execution_revision") continue;
        const owner =
          typeof meta.owner === "string" ? (meta.owner as string).toLowerCase() : null;
        const task = typeof meta.task === "string" ? (meta.task as string) : null;
        const content = typeof row.content === "string" ? row.content.trim() : "";
        if (!owner || !task || !content) continue;
        // Keep only the most recent deliverable per (owner, task) pair.
        const key = `${owner}|${task}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ owner, task, text: content });
      }
      // Order roughly chronologically (oldest first) so newer revisions
      // override older ones in the model's eyes.
      return out.reverse();
    } catch {
      return [];
    }
  })();

  let results: ExecutionRecord[];
  if (mode === "sequential") {
    // CRITICAL: in sequential mode, every action that completes feeds its
    // deliverable forward into the prompts of subsequent actions. Without
    // this, "@vee adapt @ink's thread" can't see @ink's thread and either
    // self-blocks or invents its own version. This is what made the
    // content-team test cascade-fail.
    //
    // We START with the channel backfill so even action[0] can see what
    // shipped in prior rounds, then accumulate the current run's outputs
    // on top.
    results = [];
    const priorDeliverables: Array<{ owner: string; task: string; text: string }> = [
      ...channelHistoryBackfill,
    ];
    for (let i = 0; i < total; i++) {
      const rec = await executeAction(
        svc,
        channelId,
        tenantId,
        synthesisRow,
        total,
        i,
        plan.actions[i],
        plan,
        channelName,
        onEvent,
        priorDeliverables
      );
      results.push(rec);
      if (rec.status === "done" && rec.text) {
        priorDeliverables.push({
          owner: rec.owner,
          task: rec.task,
          text: rec.text,
        });
      }
      if (rec.status === "blocked") {
        // Halt the chain. Cancel the rest so the UI shows them deliberately
        // skipped rather than pending forever.
        for (let j = i + 1; j < total; j++) {
          await persistStatus(svc, synthesisRow, total, j, "cancelled");
          onEvent({
            type: "action_done",
            actionIndex: j,
            owner: plan.actions[j].owner.toLowerCase(),
            status: "cancelled",
            attempts: 0,
          });
        }
        break;
      }
    }
    // Pad results so caller sees an entry for every action (cancelled when skipped).
    for (let i = results.length; i < total; i++) {
      results.push({
        owner: plan.actions[i].owner.toLowerCase(),
        task: plan.actions[i].task,
        status: "cancelled",
        attempts: 0,
        text: "",
        verifier: null,
        via: null,
      });
    }
  } else {
    // Parallel: actions inside THIS plan are independent of each other, but
    // we still pass the channel backfill so they can see artifacts from
    // prior rounds (e.g. Ink's thread from yesterday's synthesis when today's
    // plan dispatches @vee for a related adaptation).
    results = await Promise.all(
      plan.actions.map((action, i) =>
        executeAction(
          svc,
          channelId,
          tenantId,
          synthesisRow,
          total,
          i,
          action,
          plan,
          channelName,
          onEvent,
          channelHistoryBackfill
        )
      )
    );
  }

  const executed = results.filter((r) => r.status === "done").length;
  const blocked = results.filter((r) => r.status === "blocked").length;
  const approvedAt = new Date().toISOString();

  await svc
    .from("messages")
    .update({
      metadata: {
        ...synthesisRow.metadata,
        approved_at: approvedAt,
        approved_execution_mode: mode,
        approved_execution_summary: { executed, blocked, total },
      },
    })
    .eq("id", row.id);

  onEvent({ type: "complete", executed, blocked, total, mode });

  return {
    ok: true,
    approvedAt,
    executed,
    blocked,
    total,
    mode,
    results: results.map((r) => ({
      owner: r.owner,
      task: r.task,
      status: r.status,
      attempts: r.attempts,
      via: r.via,
      verifierGaps: r.verifier?.gaps,
    })),
  };
}

/** Non-streaming approval (legacy entry point — used by /api/.../approve and Telegram). */
export async function approveSynthesisMessage(messageId: string): Promise<ApproveResult> {
  return approveSynthesisMessageStreamed(messageId, NOOP_EVENT);
}
