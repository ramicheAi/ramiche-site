// ── METTLE — Sport Configuration (White-Label) ─────────────────────
// Defines sport-specific terminology, metrics, positions, levels, and quests.
// Add new sports by implementing SportConfig and registering in SPORT_CONFIGS.

export interface SportConfig {
  sport: string;
  sportIcon: string;
  terminology: {
    meet: string;
    event: string;
    time: string;
    lane: string;
    heat: string;
    split: string;
    personalBest: string;
  };
  metrics: string[];
  positions: string[];
  levels: { name: string; xpThreshold: number; color: string; icon: string }[];
  questTemplates: string[];
}

export const SWIMMING_CONFIG: SportConfig = {
  sport: "swimming",
  sportIcon: "🏊",
  terminology: {
    meet: "Meet",
    event: "Event",
    time: "Time",
    lane: "Lane",
    heat: "Heat",
    split: "Split",
    personalBest: "Best Time",
  },
  metrics: [
    "50 Free", "100 Free", "200 Free", "500 Free", "1000 Free", "1650 Free",
    "50 Back", "100 Back", "200 Back",
    "50 Breast", "100 Breast", "200 Breast",
    "50 Fly", "100 Fly", "200 Fly",
    "200 IM", "400 IM",
  ],
  positions: [],
  levels: [
    { name: "Rookie", xpThreshold: 0, color: "#94a3b8", icon: "🌱" },
    { name: "Contender", xpThreshold: 300, color: "#a78bfa", icon: "⚡" },
    { name: "Warrior", xpThreshold: 600, color: "#60a5fa", icon: "🔥" },
    { name: "Elite", xpThreshold: 1000, color: "#f59e0b", icon: "💎" },
    { name: "Captain", xpThreshold: 1500, color: "#f97316", icon: "⭐" },
    { name: "Legend", xpThreshold: 2500, color: "#ef4444", icon: "👑" },
  ],
  questTemplates: [
    "Drop 2 seconds in your 100 Free",
    "Complete 5 practices this week",
    "Hit a new best time in any event",
    "Swim 10,000 yards this week",
    "Attend every practice for 2 weeks straight",
    "Improve your 200 IM split consistency",
    "Master a new stroke drill",
    "Complete a full warm-up without stopping",
  ],
};

export const FOOTBALL_CONFIG: SportConfig = {
  sport: "football",
  sportIcon: "🏈",
  terminology: {
    meet: "Game",
    event: "Position",
    time: "Stats",
    lane: "Jersey #",
    heat: "Quarter",
    split: "Drive",
    personalBest: "Season Best",
  },
  metrics: [
    "Passing Yards", "Rushing Yards", "Receiving Yards",
    "Tackles", "Sacks", "Interceptions",
    "Touchdowns", "Completion %", "Fumbles",
    "Field Goals", "Punt Yards", "Kick Return Yards",
    "40-Yard Dash", "Bench Press Reps", "Vertical Jump",
  ],
  positions: [
    // Offense
    "QB", "RB", "FB", "WR", "TE", "OT", "OG", "C",
    // Defense
    "DE", "DT", "OLB", "ILB", "MLB", "CB", "FS", "SS",
    // Special Teams
    "K", "P", "LS", "KR", "PR",
  ],
  levels: [
    { name: "Rookie", xpThreshold: 0, color: "#94a3b8", icon: "🥬" },
    { name: "Starter", xpThreshold: 300, color: "#a78bfa", icon: "⚡" },
    { name: "Captain", xpThreshold: 600, color: "#60a5fa", icon: "📣" },
    { name: "MVP", xpThreshold: 1000, color: "#f59e0b", icon: "🏆" },
    { name: "Hall of Fame", xpThreshold: 1500, color: "#f97316", icon: "🏅" },
    { name: "GOAT", xpThreshold: 2500, color: "#ef4444", icon: "🐐" },
  ],
  questTemplates: [
    "Complete 10 passes in practice",
    "Run a 4.5 forty",
    "Score 3 touchdowns this week",
    "Record 5 tackles in a game",
    "Attend every practice for 2 weeks straight",
    "Improve your 40-yard dash by 0.2 seconds",
    "Complete a full conditioning circuit without stopping",
    "Learn a new offensive play from the playbook",
  ],
};

const SPORT_CONFIGS: Record<string, SportConfig> = {
  swimming: SWIMMING_CONFIG,
  football: FOOTBALL_CONFIG,
};

export function getSportConfig(sport: string): SportConfig {
  const config = SPORT_CONFIGS[sport.toLowerCase()];
  return config || SPORT_CONFIGS.swimming;
}
