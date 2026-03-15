// ── METTLE — Meet Day Scoring Engine ────────────────────────────────
// Pure functions for PB detection, time improvement calculation,
// and meet-day XP bonus awards. No side effects. Fully testable.
// ────────────────────────────────────────────────────────────────────

export interface BestTime {
  event: string;       // "100"
  stroke: string;      // "Freestyle"
  time: string;        // "52.34" or "1:02.34"
  seconds: number;     // 52.34
  course: "SCY" | "SCM" | "LCM";
  meetName: string;
  date: string;
  source: "swimcloud" | "meetmobile" | "manual" | "hytek";
}

export interface MeetResult {
  athleteId: string;
  event: string;       // "100"
  stroke: string;      // "Freestyle"
  course: "SCY" | "SCM" | "LCM";
  seedTime: string;
  finalTime: string;
  finalSeconds: number;
  place?: number;
  splits?: string[];
  dq?: boolean;
  isRelay?: boolean;
}

export interface MeetDayBonus {
  type: string;
  label: string;
  xp: number;
  detail: string;
}

export interface ScoringResult {
  athleteId: string;
  totalXP: number;
  bonuses: MeetDayBonus[];
  newBestTimes: BestTime[];
  isPB: boolean;
  improvementSeconds: number;
}

// ── XP Constants ────────────────────────────────────────────────────
const XP = {
  PB:              50,   // New personal best (any event)
  SEASON_BEST:     30,   // Season best (not lifetime)
  IMPROVEMENT_PER_HALF_SEC: 5, // Per 0.5s dropped (cap 50)
  IMPROVEMENT_CAP: 50,
  PLACE_1ST:       40,
  PLACE_2ND:       25,
  PLACE_3RD:       15,
  MULTI_EVENT:     10,   // Per event after 2nd
  RELAY:           15,
  FINALS:          20,
} as const;

// ── Time Utilities ──────────────────────────────────────────────────

export function parseTime(t: string): number {
  if (!t) return 0;
  const clean = t.replace(/[^0-9:.]/g, "").trim();
  if (!clean) return 0;
  const parts = clean.split(":");
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  return parseFloat(clean) || 0;
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return seconds.toFixed(2);
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${mins}:${secs}`;
}

export function timeKey(event: string, stroke: string, course: string): string {
  return `${event}-${stroke}-${course}`;
}

// ── Core Scoring Functions ──────────────────────────────────────────

/**
 * Check if a new time is a personal best.
 * Returns the improvement in seconds (positive = faster), or 0 if not a PB.
 */
export function detectPB(
  newSeconds: number,
  bestTimes: Record<string, BestTime>,
  event: string,
  stroke: string,
  course: string
): { isPB: boolean; improvement: number; previousBest: number } {
  const key = timeKey(event, stroke, course);
  const existing = bestTimes[key];

  if (!existing) {
    // First time in this event — counts as PB
    return { isPB: true, improvement: 0, previousBest: 0 };
  }

  const improvement = existing.seconds - newSeconds;
  return {
    isPB: improvement > 0,
    improvement: improvement > 0 ? improvement : 0,
    previousBest: existing.seconds,
  };
}

/**
 * Calculate XP bonus for time improvement.
 * 5 XP per 0.5s dropped, capped at 50 XP.
 */
export function calcImprovementXP(improvementSeconds: number): number {
  if (improvementSeconds <= 0) return 0;
  const halfSeconds = Math.floor(improvementSeconds / 0.5);
  return Math.min(halfSeconds * XP.IMPROVEMENT_PER_HALF_SEC, XP.IMPROVEMENT_CAP);
}

/**
 * Calculate placement XP bonus.
 */
export function calcPlacementXP(place: number | undefined): number {
  if (!place || place < 1) return 0;
  if (place === 1) return XP.PLACE_1ST;
  if (place === 2) return XP.PLACE_2ND;
  if (place === 3) return XP.PLACE_3RD;
  return 0;
}

/**
 * Score a single meet result for one athlete in one event.
 */
export function scoreEvent(
  result: MeetResult,
  bestTimes: Record<string, BestTime>,
  meetName: string,
  meetDate: string,
): ScoringResult {
  const bonuses: MeetDayBonus[] = [];
  const newBestTimes: BestTime[] = [];
  let totalXP = 0;

  if (result.dq || result.finalSeconds <= 0) {
    return { athleteId: result.athleteId, totalXP: 0, bonuses: [], newBestTimes: [], isPB: false, improvementSeconds: 0 };
  }

  // Relay bonus
  if (result.isRelay) {
    bonuses.push({ type: "relay", label: "Relay Swim", xp: XP.RELAY, detail: "Competed in a relay event" });
    totalXP += XP.RELAY;
    return { athleteId: result.athleteId, totalXP, bonuses, newBestTimes: [], isPB: false, improvementSeconds: 0 };
  }

  // PB detection
  const pb = detectPB(result.finalSeconds, bestTimes, result.event, result.stroke, result.course);

  if (pb.isPB) {
    bonuses.push({
      type: "pb",
      label: "Personal Best!",
      xp: XP.PB,
      detail: pb.previousBest > 0
        ? `${result.event} ${result.stroke}: ${formatTime(result.finalSeconds)} (dropped ${pb.improvement.toFixed(2)}s)`
        : `${result.event} ${result.stroke}: ${formatTime(result.finalSeconds)} (first time!)`,
    });
    totalXP += XP.PB;

    // Update best time
    newBestTimes.push({
      event: result.event,
      stroke: result.stroke,
      time: result.finalTime,
      seconds: result.finalSeconds,
      course: result.course,
      meetName,
      date: meetDate,
      source: "manual",
    });

    // Improvement bonus (stacks with PB)
    if (pb.improvement > 0) {
      const impXP = calcImprovementXP(pb.improvement);
      if (impXP > 0) {
        bonuses.push({
          type: "improvement",
          label: "Time Drop",
          xp: impXP,
          detail: `Dropped ${pb.improvement.toFixed(2)}s → +${impXP} XP`,
        });
        totalXP += impXP;
      }
    }
  }

  // Placement bonus
  const placeXP = calcPlacementXP(result.place);
  if (placeXP > 0) {
    const placeLabels = { 1: "1st Place 🥇", 2: "2nd Place 🥈", 3: "3rd Place 🥉" };
    bonuses.push({
      type: "placement",
      label: placeLabels[result.place as 1 | 2 | 3] || `${result.place}th Place`,
      xp: placeXP,
      detail: `${result.event} ${result.stroke}`,
    });
    totalXP += placeXP;
  }

  return {
    athleteId: result.athleteId,
    totalXP,
    bonuses,
    newBestTimes,
    isPB: pb.isPB,
    improvementSeconds: pb.improvement,
  };
}

/**
 * Score all events for one athlete at a meet.
 * Includes multi-event bonus.
 */
export function scoreAthleteMeet(
  results: MeetResult[],
  bestTimes: Record<string, BestTime>,
  meetName: string,
  meetDate: string,
): ScoringResult {
  if (!results.length) {
    return { athleteId: "", totalXP: 0, bonuses: [], newBestTimes: [], isPB: false, improvementSeconds: 0 };
  }

  const athleteId = results[0].athleteId;
  let totalXP = 0;
  const allBonuses: MeetDayBonus[] = [];
  const allNewBestTimes: BestTime[] = [];
  let anyPB = false;
  let totalImprovement = 0;

  // Use a running copy of bestTimes so PBs within the same meet are accounted for
  const runningBestTimes = { ...bestTimes };

  for (const result of results) {
    const scored = scoreEvent(result, runningBestTimes, meetName, meetDate);
    totalXP += scored.totalXP;
    allBonuses.push(...scored.bonuses);
    allNewBestTimes.push(...scored.newBestTimes);
    if (scored.isPB) anyPB = true;
    totalImprovement += scored.improvementSeconds;

    // Update running best times
    for (const bt of scored.newBestTimes) {
      const key = timeKey(bt.event, bt.stroke, bt.course);
      runningBestTimes[key] = bt;
    }
  }

  // Multi-event bonus (3+ individual events)
  const individualEvents = results.filter(r => !r.isRelay && !r.dq && r.finalSeconds > 0);
  if (individualEvents.length > 2) {
    const multiXP = (individualEvents.length - 2) * XP.MULTI_EVENT;
    allBonuses.push({
      type: "multi_event",
      label: "Multi-Event Bonus",
      xp: multiXP,
      detail: `Competed in ${individualEvents.length} events`,
    });
    totalXP += multiXP;
  }

  return {
    athleteId,
    totalXP,
    bonuses: allBonuses,
    newBestTimes: allNewBestTimes,
    isPB: anyPB,
    improvementSeconds: totalImprovement,
  };
}

/**
 * Convert SwimCloud BestTimeEntry format to our BestTime record.
 */
export function swimcloudToRecord(
  times: Array<{ event: string; stroke: string; time: string; seconds: number; course: string; meet: string; date: string; source: string }>
): Record<string, BestTime> {
  const record: Record<string, BestTime> = {};
  for (const t of times) {
    const key = timeKey(t.event, t.stroke, t.course);
    record[key] = {
      event: t.event,
      stroke: t.stroke,
      time: t.time,
      seconds: t.seconds,
      course: t.course as BestTime["course"],
      meetName: t.meet,
      date: t.date,
      source: t.source as BestTime["source"],
    };
  }
  return record;
}
