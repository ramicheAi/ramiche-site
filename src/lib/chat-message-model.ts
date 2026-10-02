/**
 * The message model for an agent chat turn: what is CONFIGURATION and what is CONVERSATION.
 *
 *   system     current canonical agent configuration (identity frame, role, style, rules). Only this is authority.
 *   user/assistant turns   the stored conversation, oldest to newest, as real roles. The selected agent's own past
 *              replies are `assistant`; Ramon's are `user`; other agents in a shared channel are `user` turns prefixed
 *              with their id so they are never attributed to the selected agent.
 *   user (last)   Ramon's current message.
 *
 * Why this exists: history used to be rendered into the SAME string as the system configuration, tagged
 * `[you, triage]: ...`. A stale pre-fix reply ("I'm Claude Code ...") therefore sat inside the agent's configuration
 * as the agent's own words. Conversation history must stay evidence of what was said, never configuration.
 *
 * Boundaries (verified, not assumed):
 *  - Provider Adapter / LM Studio / Claude Max proxy request body: OpenAI `messages[]`, roles preserved here.
 *  - OpenClaw `sessions_send`: ONE string into a persistent agent session. No roles exist at that boundary, so the
 *    gateway form below labels each section; it is a flattening forced by the transport, not a message model.
 *  - Claude Code CLI behind the proxy: `--print` takes one stdin prompt. The proxy serialises user/assistant turns with
 *    explicit role markers; system goes only through `--append-system-prompt` (see ops/claude-max-proxy).
 */
import type { ChatMessage } from "@/lib/provider-adapter";

export type HistoryTurn = {
  /** lowercased short id (`atlas`, `triage`, `ramon`, …) */
  speaker: string;
  /** raw text content as stored */
  content: string;
  /** ISO timestamp for ordering only */
  createdAt: string;
};

/** Per-turn cap (unchanged from the old history block); the window size is set by the loaders (30 channel / 50 thread). */
export const HISTORY_TURN_MAX_CHARS = 400;
const cap = (s: string) => (s.length > HISTORY_TURN_MAX_CHARS ? `${s.slice(0, HISTORY_TURN_MAX_CHARS)}…` : s);

/** Stored turns -> real conversation roles for `agent` (the selected agent). Order and content are preserved. */
export function historyToMessages(history: HistoryTurn[], agent: string): ChatMessage[] {
  const me = agent.toLowerCase();
  return history.map((t): ChatMessage => {
    const who = t.speaker.toLowerCase();
    if (who === "ramon") return { role: "user", content: cap(t.content) };
    if (who === me) return { role: "assistant", content: cap(t.content) };
    return { role: "user", content: `[${t.speaker}]: ${cap(t.content)}` };
  });
}

/** `system` (configuration only) + conversation turns + Ramon's current message last. */
export function agentConversationMessages(p: {
  system: string;
  history: HistoryTurn[];
  agent: string;
  currentUser: unknown;
}): ChatMessage[] {
  return [
    { role: "system", content: p.system },
    ...historyToMessages(p.history, p.agent),
    { role: "user", content: p.currentUser },
  ];
}

/** OpenClaw only accepts a single string; keep configuration, conversation and the current message in labelled sections. */
export function gatewayMessage(p: {
  header: string;
  system: string;
  history: HistoryTurn[];
  agent: string;
  displayName: string;
  currentUser: string;
}): string {
  const me = p.agent.toLowerCase();
  const lines = p.history.map((t) => {
    const who = t.speaker.toLowerCase();
    const label = who === "ramon" ? "Ramon" : who === me ? p.displayName : t.speaker;
    return `${label}: ${cap(t.content)}`;
  });
  const convo = lines.length ? `\n\nConversation so far (oldest to newest):\n${lines.join("\n")}` : "";
  return `${p.header}\n${p.system}${convo}\n\nCurrent message from Ramon:\n${p.currentUser}`;
}
