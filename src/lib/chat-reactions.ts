/**
 * CC Chat — message reactions (Phase 2.1, shared by API + UI).
 */

export const CC_REACTION_USER_ID = "00000000-0000-0000-0000-000000000001";

export const REACTION_PICKER_EMOJIS = ["👍", "🔥", "❤️", "🚀", "👀", "✅"] as const;

export type ReactionRow = { emoji: string; user_id: string };

export type AggregatedReaction = { emoji: string; count: number; me: boolean };

export function isAllowedReactionEmoji(s: string): boolean {
  return (REACTION_PICKER_EMOJIS as readonly string[]).includes(s);
}

export function aggregateReactions(
  rows: ReactionRow[],
  currentUserId: string
): AggregatedReaction[] {
  const byEmoji = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!byEmoji.has(r.emoji)) byEmoji.set(r.emoji, new Set());
    byEmoji.get(r.emoji)!.add(r.user_id);
  }
  return [...byEmoji.entries()].map(([emoji, users]) => ({
    emoji,
    count: users.size,
    me: users.has(currentUserId),
  }));
}
