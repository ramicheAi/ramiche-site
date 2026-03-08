// ── Sport-Aware Constants Wrapper ─────────────────────────────────────
// This file re-exports sport-aware versions of constants from constants.ts
// based on the selected sport config.

import { getSportConfig, type SportConfig } from "@/app/apex-athlete/lib/sport-config";

// Helper to get sport-specific terminology
export function sportTerm(key: keyof SportConfig['terminology'], sport = "swimming"): string {
  const config = getSportConfig(sport);
  return config.terminology[key];
}

// Re-export sport-config directly for convenience
export { getSportConfig } from "@/app/apex-athlete/lib/sport-config";

// Import original constants
import {
  LEVELS as SWIM_LEVELS,
  POOL_CPS as SWIM_POOL_CPS,
  WEIGHT_CPS,
  MEET_CPS as SWIM_MEET_CPS,
  WEIGHT_CHALLENGES,
  QUEST_DEFS as SWIM_QUEST_DEFS,
  CAT_COLORS,
  DAILY_XP_CAP,
  DIVING_CPS,
  WATERPOLO_CPS,
  ROSTER_GROUPS,
  SCHEDULE_TEMPLATES,
  DAYS_OF_WEEK,
  DEFAULT_CHALLENGES,
  DEFAULT_CULTURE,
  K,
} from "@/app/apex-athlete/constants";

// Sport-aware level mapping
export function getLevels(sport = "swimming") {
  const config = getSportConfig(sport);
  return config.levels;
}

// Sport-aware checkpoint mapping
export function getPoolCPs(sport = "swimming") {
  // For now, return swimming CPs for swimming, empty for other sports
  // In future, we can map sport-specific checkpoints
  if (sport === "swimming") return SWIM_POOL_CPS;
  if (sport === "diving") return DIVING_CPS;
  if (sport === "waterpolo") return WATERPOLO_CPS;
  return [];
}

export function getMeetCPs(sport = "swimming") {
  if (sport === "swimming") return SWIM_MEET_CPS;
  return [];
}

// Sport-aware quests
export function getQuestDefs(sport = "swimming") {
  const config = getSportConfig(sport);
  // Use sport-config quest templates to generate quest definitions
  return config.questTemplates.map((template, idx) => ({
    id: `quest-${sport}-${idx}`,
    name: template,
    desc: template,
    xp: 30,
    cat: "SKILL",
  }));
}

// Export the rest unchanged for now
export {
  WEIGHT_CPS,
  WEIGHT_CHALLENGES,
  CAT_COLORS,
  DAILY_XP_CAP,
  ROSTER_GROUPS,
  SCHEDULE_TEMPLATES,
  DAYS_OF_WEEK,
  DEFAULT_CHALLENGES,
  DEFAULT_CULTURE,
  K,
};