/**
 * Call-outcome taxonomy — single source of truth for the call-logging feature
 * (leads list quick-log, Deal Room strip, and /api/command-center/leads/call).
 * Speed-to-lead + BAMFAM doctrine: every dial gets logged, obvious outcomes
 * move the stage so the pipeline stays honest without extra clicks.
 */
export const CALL_OUTCOME_KEYS = ["interested", "booked", "callback", "voicemail", "no_answer", "turned_down"] as const;
export type CallOutcome = (typeof CALL_OUTCOME_KEYS)[number];

export interface CallEntry {
  at: string;
  outcome: CallOutcome;
  note?: string;
}

/** Display order = optimism order: the wins first, the no last. */
export const CALL_OUTCOMES: { key: CallOutcome; label: string; short: string; color: string }[] = [
  { key: "interested", label: "😊 Interested", short: "interested", color: "#22c55e" },
  { key: "booked", label: "📅 Booked meeting", short: "booked", color: "#06b6d4" },
  { key: "callback", label: "🔁 Call back later", short: "callback", color: "#f59e0b" },
  { key: "voicemail", label: "💬 Left voicemail", short: "voicemail", color: "#818cf8" },
  { key: "no_answer", label: "☎ No answer", short: "no answer", color: "#6b7280" },
  { key: "turned_down", label: "✗ Turned me down", short: "turned down", color: "#ef4444" },
];

export function outcomeMeta(key: string) {
  return CALL_OUTCOMES.find((o) => o.key === key) ?? { key: key as CallOutcome, label: key, short: key, color: "#6b7280" };
}

/** "2h ago" / "3d ago" for compact rows. */
export function agoLabel(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m || 1}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
