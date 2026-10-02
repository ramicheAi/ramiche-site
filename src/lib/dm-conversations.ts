/**
 * Multiple DM conversations per agent.
 *
 * THE SPLIT THIS ENFORCES. A DM channel's id used to BE the agent's identity uuid: `channels.id` equalled the
 * registry `dmUuid`, which is also written to `messages.sender_agent_id`. One value meant two things, so an
 * agent could only ever have one conversation and the UI had to reverse-map a channel id into an agent.
 *
 *   agent identity        = the registry dmUuid. Stable. Never changes. Still what sender_agent_id holds.
 *   conversation identity = `channels.id`. A fresh uuid per conversation.
 *   the link              = `channels.agent_id` -> the agent's dmUuid.
 *
 * The 20 legacy rows satisfy `id === agent_id`, which is why the backfill is correct and why they keep working
 * untouched. Everything here is pure so it can be tested without a database.
 */

/** The subset of a channel row this module reasons about. */
export type ConversationChannel = {
  id: string;
  /** The owning agent's registry dmUuid. Null/undefined for group and project channels. */
  agentId?: string | null;
  title?: string | null;
  name?: string | null;
  slug?: string | null;
  type?: string | null;
  createdAt?: string | null;
};

export const MAX_TITLE_LENGTH = 80;

/**
 * A legacy DM is one of the 20 originally-seeded rows, where the conversation id and the agent id are the
 * same value. Used to keep their OpenClaw session keys and behaviour byte-identical to before this feature.
 */
export function isLegacyDmChannel(channelId: string, agentUuid: string): boolean {
  return channelId.toLowerCase() === agentUuid.toLowerCase();
}

/**
 * Slug for a new conversation. `channels` has UNIQUE (tenant_id, slug), so this derives from the fresh
 * channel uuid rather than from a counter: no read-modify-write race, and a retry with a new uuid is a new
 * slug. 12 hex characters of a v4 uuid, and the caller retries on the unique violation anyway.
 */
export function conversationSlug(agentId: string, channelId: string): string {
  const suffix = channelId.replace(/-/g, "").slice(0, 12).toLowerCase();
  return `dm-${agentId.toLowerCase()}-${suffix}`;
}

/** Trim a caller-supplied title; empty or whitespace-only becomes null so the display falls back to the name. */
export function normalizeTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
  return t.length > 0 ? t : null;
}

/** Default label for the Nth conversation with an agent. The first one keeps the plain agent name. */
export function defaultConversationTitle(agentName: string, existingCount: number): string {
  return existingCount <= 0 ? agentName : `${agentName} ${existingCount + 1}`;
}

/**
 * Every conversation belonging to one agent, oldest first, with the legacy row first when present so the
 * ordering (and therefore the default numbering) is stable as new conversations are added.
 */
export function listAgentConversations<T extends ConversationChannel>(channels: T[], agentUuid: string): T[] {
  const mine = channels.filter(
    (c) => (c.type ?? "") === "dm" && typeof c.agentId === "string" && c.agentId.toLowerCase() === agentUuid.toLowerCase(),
  );
  return mine.sort((a, b) => {
    const al = isLegacyDmChannel(a.id, agentUuid) ? 0 : 1;
    const bl = isLegacyDmChannel(b.id, agentUuid) ? 0 : 1;
    if (al !== bl) return al - bl;
    const at = a.createdAt ?? "";
    const bt = b.createdAt ?? "";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

/** Display label for one conversation row. */
export function conversationLabel(c: ConversationChannel, agentName: string, index: number): string {
  return normalizeTitle(c.title) ?? (index === 0 ? agentName : `${agentName} ${index + 1}`);
}

/**
 * Resolve the agent a channel belongs to WITHOUT reverse-mapping the channel id. `agent_id` is the only
 * link; a channel with no `agent_id` is not a DM, whatever its id happens to look like.
 */
export function agentUuidForChannel(channels: ConversationChannel[], channelId: string): string | null {
  const ch = channels.find((c) => c.id.toLowerCase() === channelId.toLowerCase());
  if (!ch || (ch.type ?? "") !== "dm") return null;
  return typeof ch.agentId === "string" && ch.agentId ? ch.agentId : null;
}
