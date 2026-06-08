/* ============================================================================
 * PARALLAX OS — shared data: nav map, 20-agent roster, comms, vitals/feed.
 * Ported from docs/parallax-os-redesign/prototype/po-data.jsx.
 * Accent values are CSS custom-property refs (resolve inside .po-shell).
 * ========================================================================== */

/** accent spectrum as CSS var refs (per-section colors) */
export const A = {
  purple: "var(--c-purple)", gold: "var(--c-gold)", pink: "var(--c-pink)", green: "var(--c-green)",
  amber: "var(--c-amber)", cyan: "var(--c-cyan)", red: "var(--c-red)", indigo: "var(--c-indigo)",
  teal: "var(--c-teal)", rose: "var(--c-rose)", orange: "var(--c-orange)", sky: "var(--c-sky)",
  fuchsia: "var(--c-fuchsia)", violet: "var(--c-violet)",
} as const;

export type NavItem = { id: string; label: string; icon: string; accent: string; badge?: string };
export type NavSection = { label: string; items: NavItem[] };

/** design nav (the curated showpiece grouping; real routes live in ROUTE) */
export const NAV: NavSection[] = [
  { label: "Operations", items: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard", accent: A.gold },
    { id: "comms", label: "Comms", icon: "comms", accent: A.purple, badge: "12" },
    { id: "gallery", label: "Gallery", icon: "gallery", accent: A.pink },
    { id: "agents", label: "Agents", icon: "agents", accent: A.green },
    { id: "tasks", label: "Tasks", icon: "tasks", accent: A.amber, badge: "7" },
    { id: "health", label: "System Health", icon: "health", accent: A.cyan },
    { id: "security", label: "Security", icon: "security", accent: A.red },
    { id: "yolo", label: "YOLO Builds", icon: "bolt", accent: A.amber },
    { id: "nerve", label: "Nerve Center", icon: "nerve", accent: A.purple },
    { id: "settings", label: "Settings", icon: "settings", accent: A.indigo },
  ]},
  { label: "Business", items: [
    { id: "finance", label: "Finance HQ", icon: "finance", accent: A.gold },
    { id: "arbitrage", label: "Arbitrage", icon: "arbitrage", accent: A.gold },
    { id: "sales", label: "Sales", icon: "sales", accent: A.amber },
    { id: "proposals", label: "Proposals", icon: "proposals", accent: A.amber },
    { id: "legal", label: "Legal", icon: "legal", accent: A.indigo },
    { id: "strategy", label: "Strategy", icon: "strategy", accent: A.violet },
    { id: "observatory", label: "Observatory", icon: "observatory", accent: A.violet },
    { id: "reports", label: "Reports", icon: "reports", accent: A.amber },
  ]},
  { label: "Creative", items: [
    { id: "content", label: "Content", icon: "content", accent: A.fuchsia },
    { id: "studio", label: "Studio", icon: "studio", accent: A.amber },
    { id: "builder", label: "App Builder", icon: "builder", accent: A.cyan },
  ]},
  { label: "Specialist", items: [
    { id: "wellness", label: "Wellness", icon: "wellness", accent: A.teal },
    { id: "fabrication", label: "Fabrication", icon: "fabrication", accent: A.teal },
  ]},
  { label: "Workspace", items: [
    { id: "projects", label: "Projects", icon: "projects", accent: A.indigo },
    { id: "memory", label: "Memory", icon: "memory", accent: A.violet },
    { id: "calendar", label: "Calendar", icon: "calendar", accent: A.sky },
    { id: "docs", label: "Docs", icon: "docs", accent: A.indigo },
    { id: "office", label: "Office", icon: "office", accent: A.cyan },
    { id: "mettle", label: "METTLE", icon: "mettle", accent: A.gold },
  ]},
];

/** nav id → real route in this codebase (keeps existing routing intact) */
export const ROUTE: Record<string, string> = {
  dashboard: "/command-center",
  comms: "/command-center/comms",
  gallery: "/command-center/gallery",
  agents: "/command-center/agents",
  tasks: "/command-center/tasks",
  health: "/command-center/health",
  security: "/command-center/security",
  yolo: "/command-center/yolo",
  nerve: "/command-center/nerve-center",
  settings: "/command-center/settings",
  finance: "/command-center/finance",
  arbitrage: "/command-center/finance/arbitrage",
  sales: "/command-center/sales",
  proposals: "/command-center/sales/proposals",
  legal: "/command-center/legal",
  strategy: "/command-center/strategy",
  observatory: "/command-center/observatory",
  reports: "/command-center/reports",
  content: "/command-center/content",
  studio: "/command-center/studio",
  builder: "/command-center/app-builder",
  wellness: "/command-center/wellness",
  fabrication: "/command-center/fabrication",
  projects: "/command-center/projects",
  memory: "/command-center/memory",
  calendar: "/command-center/calendar",
  docs: "/command-center/docs",
  office: "/command-center/office",
  mettle: "/apex-athlete",
};

export const PAGE: Record<string, NavItem & { section: string }> = {};
NAV.forEach((s) => s.items.forEach((i) => { PAGE[i.id] = { ...i, section: s.label }; }));

export type AgentStatus = "active" | "busy" | "idle";
export type Agent = {
  id: string; name: string; role: string; sigil: string; fac: string;
  status: AgentStatus; task: string; lead?: boolean; char: number;
};

/** the 20-agent fleet (Atlas = lead orchestrator) */
export const AGENTS: Agent[] = [
  { id: "atlas",    name: "ATLAS",    role: "Operations Lead",    sigil: "atlas",      fac: A.gold,    status: "active", task: "orchestrating the fleet", lead: true, char: 1 },
  { id: "shuri",    name: "SHURI",    role: "Creative Coding",    sigil: "builder",    fac: A.green,   status: "busy",   task: "compiling app-builder v2", char: 6 },
  { id: "vee",      name: "VEE",      role: "Brand & Marketing",  sigil: "content",    fac: A.pink,    status: "active", task: "drafting launch copy", char: 3 },
  { id: "triage",   name: "TRIAGE",   role: "Incident Response",  sigil: "security",   fac: A.rose,    status: "active", task: "watching error budget", char: 4 },
  { id: "proximon", name: "PROXIMON", role: "Prospecting",        sigil: "sales",      fac: A.orange,  status: "busy",   task: "scoring 412 leads", char: 9 },
  { id: "ledger",   name: "LEDGER",   role: "Finance",            sigil: "finance",    fac: A.gold,    status: "active", task: "reconciling MRR", char: 5 },
  { id: "sentry",   name: "SENTRY",   role: "Security",           sigil: "shield",     fac: A.red,     status: "active", task: "gateway nominal", char: 2 },
  { id: "oracle",   name: "ORACLE",   role: "Analytics",          sigil: "observatory",fac: A.violet,  status: "idle",   task: "standing by", char: 8 },
  { id: "scribe",   name: "SCRIBE",   role: "Docs & Content",     sigil: "docs",       fac: A.fuchsia, status: "idle",   task: "standing by", char: 10 },
  { id: "nexus",    name: "NEXUS",    role: "Integrations",       sigil: "nexus",      fac: A.cyan,    status: "active", task: "12 bridges live", char: 6 },
  { id: "cadence",  name: "CADENCE",  role: "Studio / Audio",     sigil: "studio",     fac: A.amber,   status: "idle",   task: "standing by", char: 10 },
  { id: "horizon",  name: "HORIZON",  role: "Observatory",        sigil: "observatory",fac: A.sky,     status: "active", task: "tracking 6 signals", char: 8 },
  { id: "closer",   name: "CLOSER",   role: "Sales",              sigil: "sales",      fac: A.amber,   status: "busy",   task: "2 proposals out", char: 1 },
  { id: "counsel",  name: "COUNSEL",  role: "Legal",              sigil: "legal",      fac: A.indigo,  status: "idle",   task: "standing by", char: 2 },
  { id: "curator",  name: "CURATOR",  role: "Gallery",            sigil: "gallery",    fac: A.pink,    status: "idle",   task: "standing by", char: 3 },
  { id: "pulse",    name: "PULSE",    role: "System Health",      sigil: "health",     fac: A.cyan,    status: "active", task: "all green", char: 4 },
  { id: "warden",   name: "WARDEN",   role: "Wellness",           sigil: "wellness",   fac: A.teal,    status: "idle",   task: "standing by", char: 7 },
  { id: "mason",    name: "MASON",    role: "Fabrication",        sigil: "fabrication",fac: A.teal,    status: "busy",   task: "rendering 3 jobs", char: 7 },
  { id: "archive",  name: "ARCHIVE",  role: "Memory",             sigil: "memory",     fac: A.violet,  status: "active", task: "indexing 9k notes", char: 5 },
  { id: "vector",   name: "VECTOR",   role: "Strategy",           sigil: "strategy",   fac: A.purple,  status: "idle",   task: "standing by", char: 9 },
];
export const agentById = (id: string): Agent | undefined => AGENTS.find((a) => a.id === id);

export type Channel = { id: string; name: string; kind: "channel"; accent: string; unread: number; members: number; last: string; t: string };
export const CHANNELS: Channel[] = [
  { id: "general", name: "#general", kind: "channel", accent: A.purple, unread: 3, members: 21, last: "ATLAS: morning standup posted — all green.", t: "2m" },
  { id: "mettle", name: "#mettle", kind: "channel", accent: A.gold, unread: 12, members: 8, last: "VEE: new athlete deck is live for review.", t: "9m" },
  { id: "verified", name: "#verified-agents", kind: "channel", accent: A.green, unread: 0, members: 20, last: "SENTRY: signed 3 new agent certs.", t: "41m" },
  { id: "launch", name: "#launch-room", kind: "channel", accent: A.pink, unread: 1, members: 6, last: "SHURI: landing page shipped to edge ✦", t: "1h" },
];

export type Dm = { id: string; agentId: string; unread: number; last: string; t: string };
export const DMS: Dm[] = [
  { id: "dm-atlas", agentId: "atlas", unread: 0, last: "On it — routing to Forge now.", t: "just now" },
  { id: "dm-proximon", agentId: "proximon", unread: 2, last: "412 leads scored, 18 hot. Want outreach?", t: "12m" },
  { id: "dm-ledger", agentId: "ledger", unread: 0, last: "MRR closed the week at $48.2k, +6%.", t: "1h" },
  { id: "dm-triage", agentId: "triage", unread: 0, last: "Retry storm at 03:14 auto-healed.", t: "3h" },
  { id: "dm-shuri", agentId: "shuri", unread: 0, last: "Build times down 40% after the compiler.", t: "5h" },
];

export type Vital = { lab: string; num: string; sub: string; icon: string };
export const VITALS: Vital[] = [
  { lab: "Agents online", num: "19", sub: "/20", icon: "agents" },
  { lab: "MRR", num: "$48.2k", sub: "+6%", icon: "finance" },
  { lab: "Jobs in motion", num: "7", sub: "live", icon: "bolt" },
  { lab: "Shipped today", num: "23", sub: "builds", icon: "builder" },
];

export type FeedItem = { hash: string; msg: string; who: string; t: string };
export const FEED: FeedItem[] = [
  { hash: "a3f9c1", msg: "proximon · dedupe lead scoring pipeline", who: "PROXIMON", t: "2m" },
  { hash: "7b21de", msg: "sentry · retry backoff + circuit breaker", who: "SENTRY", t: "14m" },
  { hash: "c90a44", msg: "shuri · ship v2 template compiler", who: "SHURI", t: "38m" },
  { hash: "1e77b8", msg: "ledger · wire Stripe MRR webhook", who: "LEDGER", t: "1h" },
  { hash: "55d0a2", msg: "nexus · add Linear + Slack bridges", who: "NEXUS", t: "2h" },
];

export type Lead = { score: number; tier: "hot" | "warm"; name: string; meta: string };
export const LEADS: Lead[] = [
  { score: 96, tier: "hot",  name: "Helios Robotics", meta: "Series B · 140 staff · matched 3 signals" },
  { score: 91, tier: "hot",  name: "Vela Logistics", meta: "Seed · 32 staff · hiring ops lead" },
  { score: 88, tier: "hot",  name: "Orbit Health", meta: "Series A · 78 staff · funded 2d ago" },
  { score: 74, tier: "warm", name: "Cobalt Studio", meta: "Bootstrapped · visited pricing 4×" },
];
