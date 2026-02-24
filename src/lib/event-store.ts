/**
 * Event sourcing for practice sessions — append-only event log.
 * Events are immutable once written. Current state is derived by replaying events.
 * Stores in localStorage with Firestore sync-ready structure.
 */

export interface PracticeEvent {
  id: string;
  timestamp: number;
  type: PracticeEventType;
  sessionId: string;
  athleteId: string;
  data: Record<string, unknown>;
}

export type PracticeEventType =
  | "session_start"
  | "session_end"
  | "check_in"
  | "check_out"
  | "xp_awarded"
  | "quest_submitted"
  | "quest_reviewed"
  | "attendance_marked"
  | "time_recorded"
  | "level_up"
  | "streak_updated"
  | "note_added";

const STORE_KEY = "mettle-event-log";

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Append a new event (immutable — never overwritten) */
export function appendEvent(
  type: PracticeEventType,
  sessionId: string,
  athleteId: string,
  data: Record<string, unknown> = {}
): PracticeEvent {
  const event: PracticeEvent = {
    id: generateEventId(),
    timestamp: Date.now(),
    type,
    sessionId,
    athleteId,
    data,
  };

  const events = getAllEvents();
  events.push(event);
  localStorage.setItem(STORE_KEY, JSON.stringify(events));
  return event;
}

/** Get all events (full log) */
export function getAllEvents(): PracticeEvent[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Get events for a specific session */
export function getSessionEvents(sessionId: string): PracticeEvent[] {
  return getAllEvents().filter((e) => e.sessionId === sessionId);
}

/** Get events for a specific athlete */
export function getAthleteEvents(athleteId: string): PracticeEvent[] {
  return getAllEvents().filter((e) => e.athleteId === athleteId);
}

/** Get events by type within a date range */
export function queryEvents(
  type?: PracticeEventType,
  from?: number,
  to?: number,
  athleteId?: string
): PracticeEvent[] {
  return getAllEvents().filter((e) => {
    if (type && e.type !== type) return false;
    if (from && e.timestamp < from) return false;
    if (to && e.timestamp > to) return false;
    if (athleteId && e.athleteId !== athleteId) return false;
    return true;
  });
}

/** Derive current attendance count from events */
export function deriveAttendanceCount(athleteId: string, since?: number): number {
  return queryEvents("check_in", since, undefined, athleteId).length;
}

/** Derive total XP from events */
export function deriveTotalXP(athleteId: string): number {
  return queryEvents("xp_awarded", undefined, undefined, athleteId).reduce(
    (sum, e) => sum + ((e.data.amount as number) || 0),
    0
  );
}

/** Export events as JSON (for Firestore sync or backup) */
export function exportEvents(since?: number): PracticeEvent[] {
  if (!since) return getAllEvents();
  return getAllEvents().filter((e) => e.timestamp >= since);
}

/** Compact old events (keep last N days, archive the rest) */
export function compactEvents(keepDays = 90): { kept: number; archived: PracticeEvent[] } {
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const all = getAllEvents();
  const kept = all.filter((e) => e.timestamp >= cutoff);
  const archived = all.filter((e) => e.timestamp < cutoff);
  localStorage.setItem(STORE_KEY, JSON.stringify(kept));
  return { kept: kept.length, archived };
}
