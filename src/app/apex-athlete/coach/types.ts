// ── Shared types for coach module ─────────────────────────────

export interface DailyXP { date: string; pool: number; weight: number; meet: number; }

export interface Athlete {
  id: string; name: string; age: number; gender: "M" | "F"; group: string;
  xp: number; seasonXP?: number; streak: number; weightStreak: number; lastStreakDate: string; lastWeightStreakDate: string;
  totalPractices: number; weekSessions: number; weekWeightSessions: number; weekTarget: number;
  checkpoints: Record<string, boolean>;
  weightCheckpoints: Record<string, boolean>;
  meetCheckpoints: Record<string, boolean>;
  weightChallenges: Record<string, boolean>;
  quests: Record<string, "active" | "submitted" | "done" | "pending">;
  questNotes?: Record<string, string>;
  dailyXP: DailyXP;
  present?: boolean;
  birthday?: string;
  usaSwimmingId?: string;
  parentName?: string;
  parentPhone?: string;
  pin?: string;
  bestTimes?: Record<string, { time: string; seconds: number; meetId: string; meetName: string; date: string; course: "SCY" | "SCM" | "LCM"; source: "swimcloud" | "meetmobile" | "manual" | "hytek" }>;
}

export interface AuditEntry {
  timestamp: number; coach: string; athleteId: string; athleteName: string;
  action: string; xpDelta: number;
}

export interface TeamChallenge {
  id: string; name: string; description: string; target: number; current: number; reward: number;
}

export interface DailySnapshot {
  date: string; attendance: number; totalAthletes: number; totalXPAwarded: number;
  poolCheckins: number; weightCheckins: number; meetCheckins: number;
  questsCompleted: number; challengesCompleted: number;
  athleteXPs: Record<string, number>; athleteStreaks: Record<string, number>;
}

export interface TeamCulture {
  teamName: string; mission: string; seasonalGoal: string;
  goalTarget: number; goalCurrent: number; weeklyQuote: string;
}

export interface RosterGroup {
  readonly id: string;
  readonly name: string;
  readonly sport: string;
  readonly color: string;
  readonly icon: string;
}

export const ROSTER_GROUPS: readonly RosterGroup[] = [
  { id: "platinum", name: "Platinum", sport: "swimming", color: "#c0c0ff", icon: "💎" },
  { id: "gold", name: "Gold", sport: "swimming", color: "#f59e0b", icon: "🥇" },
  { id: "silver", name: "Silver", sport: "swimming", color: "#94a3b8", icon: "🥈" },
  { id: "bronze1", name: "Bronze 1", sport: "swimming", color: "#cd7f32", icon: "🥉" },
  { id: "bronze2", name: "Bronze 2", sport: "swimming", color: "#cd7f32", icon: "🥉" },
  { id: "diving", name: "Diving", sport: "diving", color: "#38bdf8", icon: "🤿" },
  { id: "waterpolo", name: "Water Polo", sport: "waterpolo", color: "#f97316", icon: "🤽" },
] as const;

export type GroupId = typeof ROSTER_GROUPS[number]["id"];

export function getSportForAthlete(athlete: { group: string }): string {
  const groupDef = ROSTER_GROUPS.find(g => g.id === athlete.group);
  return groupDef?.sport || "swimming";
}

// ── Meet types ──────────────────────────────────────────────

export interface MeetEventEntry {
  athleteId: string;
  seedTime: string;
  finalTime?: string;
  place?: number;
  splits?: string[];
  dq?: boolean;
  dqReason?: string;
  improvement?: number;
  heat?: number;
  lane?: number;
}

export interface MeetEvent {
  id: string;
  name: string;
  eventNum?: number;
  gender?: "M" | "F" | "Mixed";
  qualifyingTime?: string;
  entries: MeetEventEntry[];
  lanesPerHeat?: number;
}

export interface MeetBroadcast {
  id: string;
  message: string;
  timestamp: number;
  sentBy: string;
}

export interface SwimMeet {
  id: string;
  name: string;
  date: string;
  location: string;
  course: "SCY" | "SCM" | "LCM";
  rsvpDeadline: string;
  events: MeetEvent[];
  rsvps: Record<string, "committed" | "declined" | "pending">;
  broadcasts: MeetBroadcast[];
  status: "upcoming" | "active" | "completed";
}

// ── Wellness types ──────────────────────────────────────────

export interface MentalReadiness {
  date: string; focus: number; energy: number; confidence: number; motivation: number;
}
export interface BreathworkSession {
  date: string; completedAt: number; rounds: number;
}
export interface JournalEntry {
  date: string; wentWell: string; challenging: string; improve: string; completedAt: number;
}
export interface RecoveryLog {
  date: string; sleepQuality: number; sorenessLevel: number; hydrationGlasses: number;
}
export interface WellnessData {
  mentalReadiness: MentalReadiness[];
  breathworkSessions: BreathworkSession[];
  journalEntries: JournalEntry[];
  recoveryLogs: RecoveryLog[];
}
