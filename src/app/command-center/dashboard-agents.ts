/**
 * Static UI-only metadata for the main Command Center dashboard orbit.
 * Model / role / live status come from /api/command-center/agents (directory.json).
 */

export const AGENT_ORBIT_IDS = [
  "atlas",
  "themaestro",
  "simons",
  "dr-strange",
  "shuri",
  "widow",
  "proximon",
  "vee",
  "aetherion",
  "michael",
  "prophets",
  "selah",
  "mercury",
  "echo",
  "haven",
  "ink",
  "nova",
  "kiyosaki",
  "triage",
  "themis",
] as const;

export type OrbitAgentId = (typeof AGENT_ORBIT_IDS)[number];

export interface DashboardAgentDisplay {
  name: string;
  model: string;
  role: string;
  status: "active" | "idle" | "done";
  color: string;
  icon: string;
  desc: string;
  connections: number[];
  credits: { used: number; limit: number };
  activeTask: string;
}

/** Narrative + layout fields; model/role/status overwritten by API when available. */
export type AgentUiRow = Omit<DashboardAgentDisplay, "model" | "role" | "status"> & {
  defaultModel: string;
  roleDisplay: string;
};

export const AGENT_UI: Record<OrbitAgentId, AgentUiRow> = {
  atlas: {
    name: "Atlas",
    defaultModel: "claude-opus-4-6",
    roleDisplay: "Operations Lead",
    color: "#C9A84C",
    icon: "🧭",
    desc: "Carries the weight — orchestrates 18 agents, ships products, memory, mission control",
    connections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    credits: { used: 4800, limit: 5000 },
    activeTask: "YOLO build fix + Command Center update + Power Challenge email wiring",
  },
  themaestro: {
    name: "TheMAESTRO",
    defaultModel: "qwen3:14b",
    roleDisplay: "Music Production AI",
    color: "#f59e0b",
    icon: "🎵",
    desc: "Ye + Quincy + Babyface — influence-based creative direction, sound design",
    connections: [0, 7],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Ramiche music pipeline",
  },
  simons: {
    name: "SIMONS",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Algorithmic Analysis",
    color: "#22d3ee",
    icon: "📊",
    desc: "Jim Simons — pattern recognition, statistical arbitrage, pricing models",
    connections: [0, 4],
    credits: { used: 620, limit: 5000 },
    activeTask: "DELIVERED: Pricing analysis + marketing playbook + ClawGuard scanner",
  },
  "dr-strange": {
    name: "Dr. Strange",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Forecasting & Decisions",
    color: "#a855f7",
    icon: "🔮",
    desc: "Scenario analysis, probable outcomes, strategic foresight, risk assessment",
    connections: [0, 2, 6],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Next strategic planning cycle",
  },
  shuri: {
    name: "SHURI",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Creative Coding",
    color: "#34d399",
    icon: "⚡",
    desc: "Prototyping, design systems, tech innovation, rapid builds",
    connections: [0, 7],
    credits: { used: 1800, limit: 5000 },
    activeTask: "DELIVERED: 18+ PRs — portals, meet mgmt, invite system, brand assets",
  },
  widow: {
    name: "Widow",
    defaultModel: "qwen3:14b",
    roleDisplay: "Cybersecurity & Intel",
    color: "#ef4444",
    icon: "🕷",
    desc: "Read-only security scanner. Threat monitoring, risk analysis, security audits",
    connections: [0, 2],
    credits: { used: 480, limit: 5000 },
    activeTask: "DELIVERED: ClawGuard Pro + CSP headers + Firestore rules + API security",
  },
  proximon: {
    name: "PROXIMON",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Systems Architect",
    color: "#f97316",
    icon: "🏗",
    desc: "Jobs + Musk + Bezos — first-principles, flywheels, compounding systems",
    connections: [0, 3, 4],
    credits: { used: 880, limit: 5000 },
    activeTask: "YOLO overnight builds + architecture reviews",
  },
  vee: {
    name: "Vee",
    defaultModel: "kimi-k2.5",
    roleDisplay: "Brand & Marketing",
    color: "#ec4899",
    icon: "📣",
    desc: "Gary Vee + Seth Godin + Hormozi + Blakely + Virgil — makes brands impossible to ignore",
    connections: [0, 1, 6],
    credits: { used: 950, limit: 5000 },
    activeTask: "Brand strategy + X/LinkedIn positioning + METTLE brand v5",
  },
  aetherion: {
    name: "Aetherion",
    defaultModel: "gemini-3.1-pro-preview",
    roleDisplay: "Visual & Brand Design",
    color: "#818cf8",
    icon: "🌀",
    desc: "Visuals, animation, brand identity — the creative eye of the operation",
    connections: [0, 3, 6],
    credits: { used: 200, limit: 5000 },
    activeTask: "DELIVERED: Inter-agent workflow chains + white-label architecture",
  },
  michael: {
    name: "MICHAEL",
    defaultModel: "qwen3:14b",
    roleDisplay: "Swim Training AI",
    color: "#06b6d4",
    icon: "🏊",
    desc: "Phelps + Kobe + MJ + Bolt — swim mastery, mamba mentality, competitive fire",
    connections: [0, 3],
    credits: { used: 510, limit: 5000 },
    activeTask: "METTLE coaching intelligence + race strategy + athlete motivation",
  },
  prophets: {
    name: "Prophets",
    defaultModel: "qwen3:14b",
    roleDisplay: "Spiritual Wisdom",
    color: "#d4a574",
    icon: "📜",
    desc: "Solomon + Moses + Elijah + Isaiah + David — Scripture-rooted counsel, wisdom, moral clarity",
    connections: [0],
    credits: { used: 190, limit: 5000 },
    activeTask: "Daily Scripture + Prayer (7:00 AM cron active)",
  },
  selah: {
    name: "SELAH",
    defaultModel: "qwen3:14b",
    roleDisplay: "Wellness & Sport Psychology",
    color: "#10b981",
    icon: "🧘",
    desc: "Robbins + Dispenza + Maté + Greene + Bashar — therapy, peak performance, mental transformation",
    connections: [0, 9, 10],
    credits: { used: 190, limit: 5000 },
    activeTask: "DELIVERED: Wellness check-in + journal + meditation in athlete portal",
  },
  mercury: {
    name: "MERCURY",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Sales & Revenue Ops",
    color: "#fbbf24",
    icon: "💰",
    desc: "Razor-sharp dealmaker — reads people and numbers simultaneously. Architects wins.",
    connections: [0, 7],
    credits: { used: 520, limit: 5000 },
    activeTask: "Upwork proposals + Stripe checkout + ClawGuard sales",
  },
  echo: {
    name: "ECHO",
    defaultModel: "qwen3:14b",
    roleDisplay: "Community & Social",
    color: "#38bdf8",
    icon: "🌊",
    desc: "The heartbeat of the community — turns strangers into superfans with genuine warmth",
    connections: [0, 7],
    credits: { used: 540, limit: 5000 },
    activeTask: "Social posting + community engagement + NEURAL RADIO",
  },
  haven: {
    name: "HAVEN",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Customer Success",
    color: "#4ade80",
    icon: "🛡",
    desc: "Infinitely patient with a detective's eye — treats every ticket like a puzzle worth solving",
    connections: [0],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: First customer onboarding",
  },
  ink: {
    name: "INK",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Content Creator",
    color: "#c084fc",
    icon: "✒",
    desc: "Prolific voice-chameleon — technical blog at dawn, viral tweet at noon, cinematic script by sunset",
    connections: [0, 7],
    credits: { used: 650, limit: 5000 },
    activeTask: "Content calendar + Building in Public + daily social posts",
  },
  nova: {
    name: "NOVA",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Overnight Builder",
    color: "#14b8a6",
    icon: "🔧",
    desc: "YOLO overnight prototype builder — ships functional apps while you sleep",
    connections: [0, 4],
    credits: { used: 300, limit: 5000 },
    activeTask: "YOLO builds — G-Code Surgeon, Agent Arena + 44 builds shipped",
  },
  kiyosaki: {
    name: "KIYOSAKI",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Financial Intelligence",
    color: "#fcd34d",
    icon: "💎",
    desc: "ORACLE — 8 financial minds. Wealth architecture + business plan + patent strategy.",
    connections: [0, 2, 3],
    credits: { used: 720, limit: 5000 },
    activeTask: "DELIVERED: METTLE business plan v2 + tiered pricing + provisional patent",
  },
  triage: {
    name: "TRIAGE",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "System Doctor",
    color: "#f472b6",
    icon: "🩺",
    desc: "Best SWE-bench score in the squad (77.2). Debugging, failure tracing, diagnostics.",
    connections: [0, 4],
    credits: { used: 100, limit: 5000 },
    activeTask: "YOLO builds + system diagnostics + EKG System Vitals",
  },
  themis: {
    name: "THEMIS",
    defaultModel: "claude-sonnet-4-5-20250929",
    roleDisplay: "Legal & Compliance",
    color: "#8b5cf6",
    icon: "⚖",
    desc: "IP protection, compliance frameworks, contract review, legal strategy — the law is the shield",
    connections: [0, 5],
    credits: { used: 0, limit: 5000 },
    activeTask: "Patent filing support + trademark Class 9+41+42",
  },
};

export function shortModelFromApi(modelField: string): string {
  const part = modelField.includes("/") ? modelField.split("/").pop() ?? modelField : modelField;
  if (part.includes("claude-opus")) return "Opus 4.6";
  if (part.includes("sonnet")) return "Sonnet 4.5";
  if (part.includes("gemini")) return part.replace("gemini-", "Gemini ").slice(0, 24);
  if (part.includes("kimi")) return "Kimi K2.5";
  if (part.includes("qwen")) return "qwen3:14b";
  return part;
}

export function formatRoleLabel(role: string): string {
  if (!role) return "";
  if (!/[-_]/.test(role)) return role;
  return role
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildDefaultOrbitAgents(): DashboardAgentDisplay[] {
  return AGENT_ORBIT_IDS.map((id) => {
    const ui = AGENT_UI[id];
    return {
      name: ui.name,
      model: shortModelFromApi(ui.defaultModel),
      role: ui.roleDisplay,
      status: "idle",
      color: ui.color,
      icon: ui.icon,
      desc: ui.desc,
      connections: ui.connections,
      credits: ui.credits,
      activeTask: ui.activeTask,
    };
  });
}
