/**
 * Outcome metrics tracker for METTLE.
 * Tracks measurable business outcomes: attendance rates, engagement,
 * hours saved, and athlete progression — the proof points coaches
 * need to justify the investment and that sales conversations require.
 */

interface OutcomeSnapshot {
  date: string;
  teamId: string;
  attendanceRate: number;      // % of rostered athletes who checked in
  activeAthleteRate: number;   // % of athletes with activity in last 7 days
  avgXPPerAthlete: number;     // average XP across active athletes
  questCompletionRate: number; // % of assigned quests completed
  streakCount: number;         // athletes with 3+ day streaks
  totalPractices: number;      // total check-ins this period
  coachTimeSavedMin: number;   // estimated minutes saved vs manual tracking
}

const STORAGE_KEY = "mettle_outcome_metrics";

/** Calculate outcome metrics from current roster and session data */
export function calculateOutcomes(
  roster: Array<{ name: string; xp?: number; streak?: number; questsCompleted?: number; questsAssigned?: number }>,
  checkedIn: string[],
  practiceLog: Array<{ date: string; count: number }>
): OutcomeSnapshot {
  const total = roster.length || 1;
  const activeCount = roster.filter(a => (a.xp || 0) > 0).length;
  const avgXP = roster.reduce((sum, a) => sum + (a.xp || 0), 0) / total;
  const streaks = roster.filter(a => (a.streak || 0) >= 3).length;
  const questsDone = roster.reduce((s, a) => s + (a.questsCompleted || 0), 0);
  const questsTotal = roster.reduce((s, a) => s + (a.questsAssigned || 0), 0) || 1;
  const totalPractices = practiceLog.reduce((s, p) => s + p.count, 0);
  // Estimate: manual attendance tracking takes ~2min/athlete. METTLE does it in seconds.
  const timeSaved = totalPractices * 1.5;

  return {
    date: new Date().toISOString().split("T")[0],
    teamId: "default",
    attendanceRate: Math.round((checkedIn.length / total) * 100),
    activeAthleteRate: Math.round((activeCount / total) * 100),
    avgXPPerAthlete: Math.round(avgXP),
    questCompletionRate: Math.round((questsDone / questsTotal) * 100),
    streakCount: streaks,
    totalPractices,
    coachTimeSavedMin: Math.round(timeSaved),
  };
}

/** Save a snapshot to localStorage history */
export function saveSnapshot(snapshot: OutcomeSnapshot): void {
  try {
    const history = getHistory();
    history.push(snapshot);
    // Keep last 90 days
    const trimmed = history.slice(-90);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* localStorage full or unavailable */ }
}

/** Get historical snapshots */
export function getHistory(): OutcomeSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Get a summary string for display */
export function getOutcomeSummary(snapshot: OutcomeSnapshot): string {
  return [
    `${snapshot.attendanceRate}% attendance`,
    `${snapshot.activeAthleteRate}% active athletes`,
    `${snapshot.avgXPPerAthlete} avg XP`,
    `${snapshot.questCompletionRate}% quests completed`,
    `${snapshot.streakCount} athletes on streaks`,
    `~${snapshot.coachTimeSavedMin} min saved`,
  ].join(" · ");
}
