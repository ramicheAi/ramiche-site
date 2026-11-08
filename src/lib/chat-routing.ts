/**
 * CC Chat routing — @mentions and multi-agent targets (shared by API + UI).
 */

import { chatAgentIds } from "@/lib/agent-registry-core";

const AGENT_IDS = chatAgentIds();

export const KNOWN_AGENT_IDS = new Set<string>(AGENT_IDS);

const MAX_PARALLEL_AGENTS = 12;

function normalizeAgentId(id: string): string {
  return String(id).toLowerCase().trim();
}

/** Extract @agent ids from message text (e.g. @shuri @atlas). */
export function parseMentions(text: string): string[] {
  const out: string[] = [];
  const re = /@([a-z][a-z0-9_-]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = normalizeAgentId(m[1] ?? "");
    if (KNOWN_AGENT_IDS.has(id)) out.push(id);
  }
  return [...new Set(out)];
}

export function resolveChatTargets(input: {
  mentionedAgents?: string[] | null;
  agentName?: string | null;
  channelMembers?: string[] | null;
  /**
   * CC-ORG-INTELLIGENCE-01 / CC-ORG-FOUNDATION-02 Phase B.
   *
   * Every real channel today is "bootstrap mode" — there is no server-side
   * channel_principal / channel_policy table yet, so client-submitted
   * `channelMembers` is the only membership signal available and is trusted
   * directly (see CC-ORG-AUTHORIZATION-DESIGN-01.md for the full writeup of
   * why that is, and what replaces it).
   *
   * Defaults to `true` so every existing call site, and every test written
   * before this flag existed, keeps its exact current behavior. Only a
   * future channel explicitly marked non-bootstrap (`bootstrapMode: false`)
   * takes the fail-closed branch below — no real channel does today, so
   * that branch is dead-but-correct until a real channel_principal lookup
   * exists to feed `resolvedMembers`.
   */
  bootstrapMode?: boolean;
  /**
   * Server-verified membership for a non-bootstrap channel (e.g. resolved
   * from a future `channel_principal` table). Only consulted when
   * `bootstrapMode === false`. Never derived from client input.
   */
  resolvedMembers?: string[] | null;
}): string[] {
  const { mentionedAgents, agentName, channelMembers, bootstrapMode = true, resolvedMembers } = input;
  if (mentionedAgents && Array.isArray(mentionedAgents) && mentionedAgents.length > 0) {
    const uniq = [
      ...new Set(mentionedAgents.map(normalizeAgentId).filter((id) => KNOWN_AGENT_IDS.has(id))),
    ];
    if (uniq.length > 0) return uniq.slice(0, MAX_PARALLEL_AGENTS);
  }
  if (agentName) {
    const a = normalizeAgentId(agentName);
    return [KNOWN_AGENT_IDS.has(a) ? a : "atlas"];
  }
  if (bootstrapMode === false) {
    // Fail closed: a non-bootstrap channel must never fall through to the
    // client-submitted channelMembers. Only a real, server-verified
    // membership list may resolve targets here. No channelMembers at all
    // (bootstrap channels, nothing passed) keeps today's behavior via the
    // branch below; this branch only fires once a channel is explicitly
    // flagged non-bootstrap, which no real channel is yet.
    if (resolvedMembers && Array.isArray(resolvedMembers) && resolvedMembers.length > 0) {
      const members = [
        ...new Set(resolvedMembers.map(normalizeAgentId).filter((id) => KNOWN_AGENT_IDS.has(id))),
      ];
      if (members.length > 0) return members.slice(0, MAX_PARALLEL_AGENTS);
    }
    // No verified members for a non-bootstrap channel: route to nobody
    // rather than guessing or silently defaulting to "atlas" (that would
    // mask a missing-membership-lookup bug as a normal response).
    return [];
  }
  if (channelMembers && Array.isArray(channelMembers) && channelMembers.length > 0) {
    const members = [
      ...new Set(channelMembers.map(normalizeAgentId).filter((id) => KNOWN_AGENT_IDS.has(id))),
    ];
    if (members.length > 0) return members.slice(0, MAX_PARALLEL_AGENTS);
  }
  return ["atlas"];
}
