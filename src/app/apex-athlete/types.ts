// ── Shared Types for Apex Athlete ──────────────────────────────────

export interface DailyXP {
  date: string;
  pool: number;
  weight: number;
  meet: number;
}

export interface Athlete {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F";
  group: string;
  xp: number;
  streak: number;
  weightStreak: number;
  lastStreakDate: string;
  lastWeightStreakDate: string;
  totalPractices: number;
  weekSessions: number;
  weekWeightSessions: number;
  weekTarget: number;
  checkpoints: Record<string, boolean>;
  weightCheckpoints: Record<string, boolean>;
  meetCheckpoints: Record<string, boolean>;
  weightChallenges: Record<string, boolean>;
  quests: Record<string, "active" | "done" | "pending">;
  dailyXP: DailyXP;
}

export interface AuditEntry {
  timestamp: number;
  coach: string;
  athleteId: string;
  athleteName: string;
  action: string;
  xpDelta: number;
}

export interface TeamChallenge {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  reward: number;
}

export interface DailySnapshot {
  date: string;
  attendance: number;
  totalAthletes: number;
  totalXPAwarded: number;
  poolCheckins: number;
  weightCheckins: number;
  meetCheckins: number;
  questsCompleted: number;
  challengesCompleted: number;
  athleteXPs: Record<string, number>;
  athleteStreaks: Record<string, number>;
}

export interface TeamCulture {
  teamName: string;
  mission: string;
  seasonalGoal: string;
  goalTarget: number;
  goalCurrent: number;
  weeklyQuote: string;
}

export interface Checkpoint {
  id: string;
  name: string;
  xp: number;
  desc: string;
}

export interface Quest {
  id: string;
  name: string;
  desc: string;
  xp: number;
  cat: "SKILL" | "LEADERSHIP" | "RECOVERY" | "STRENGTH" | "MINDSET";
}

export type GroupId = "platinum" | "gold" | "silver" | "bronze1" | "bronze2" | "diving" | "waterpolo";
export type SessionMode = "pool" | "weight" | "meet";
export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type SessionType = "pool" | "weight" | "dryland";

export interface ScheduleSession {
  id: string;
  type: SessionType;
  label: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  location: string;
  notes: string;
}

export interface DaySchedule {
  template: string; // template id
  sessions: ScheduleSession[];
}

export interface GroupSchedule {
  groupId: GroupId;
  weekSchedule: Record<DayOfWeek, DaySchedule>;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

// ── Wellness types (for SELAH integration) ─────────────────
export interface MentalReadiness {
  date: string;
  focus: number;
  energy: number;
  confidence: number;
  motivation: number;
}

export interface BreathworkSession {
  date: string;
  completedAt: number;
  rounds: number;
}

export interface JournalEntry {
  date: string;
  wentWell: string;
  challenging: string;
  improve: string;
  completedAt: number;
}

export interface RecoveryLog {
  date: string;
  sleepQuality: number;
  sorenessLevel: number;
  hydrationGlasses: number;
}

export interface WellnessData {
  mentalReadiness: MentalReadiness[];
  breathworkSessions: BreathworkSession[];
  journalEntries: JournalEntry[];
  recoveryLogs: RecoveryLog[];
}