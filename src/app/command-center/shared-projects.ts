/* ══════════════════════════════════════════════════════════════════════════════
   SHARED PROJECT DATA — Single source of truth for Missions + Projects
   ══════════════════════════════════════════════════════════════════════════════ */

export interface ProjectTask {
  t: string;
  done: boolean;
}

export interface SharedProject {
  name: string;
  slug: string;
  accent: string;
  status: "active" | "blocked" | "shipped" | "planning" | "paused";
  desc: string;
  priority: number;
  priorityLabel: string;
  agents: string[];
  lead: string;
  tasks: ProjectTask[];
  blockers?: string[];
  link: { label: string; href: string } | null;
}

export const PROJECTS: SharedProject[] = [
  {
    name: "METTLE",
    slug: "mettle",
    accent: "#C9A84C",
    status: "active",
    desc: "Gamified swim training — LIVE BETA — Stripe checkout live",
    priority: 1,
    priorityLabel: "CRITICAL",
    agents: ["Atlas", "SHURI", "PROXIMON", "MICHAEL", "SELAH", "KIYOSAKI", "TRIAGE"],
    lead: "Atlas",
    tasks: [
      { t: "Game engine + check-ins", done: true },
      { t: "Coach dashboard + leaderboard", done: true },
      { t: "Three-portal architecture (Coach/Athlete/Parent)", done: true },
      { t: "Multi-roster expansion (240+ athletes, 7 groups)", done: true },
      { t: "Stripe billing — 3 tiers ($149/$349/$549)", done: true },
      { t: "CI/CD pipeline (GitHub Actions + Husky + Vitest)", done: true },
      { t: "Copyright filed (Feb 17, 2026)", done: true },
      { t: "Hy-Tek import (.hy3/.ev3) — iOS fix deployed", done: true },
      { t: "ByteByteGo 52/52 items implemented", done: true },
      { t: "Quest flow UX polish", done: true },
      { t: "Firebase backend (v2) deploy", done: true },
      { t: "Beta launch (Saint Andrew's)", done: false },
      { t: "Stripe live payments", done: false },
      { t: "Patent filing (USPTO)", done: false },
    ],
    blockers: ["STRIPE_SECRET_KEY for live payments"],
    link: { label: "Open App", href: "/apex-athlete" },
  },
  {
    name: "Parallax Publish",
    slug: "parallax-publish",
    accent: "#7c3aed",
    status: "active",
    desc: "Multi-platform social media publishing — 4 platforms live",
    priority: 2,
    priorityLabel: "HIGH",
    agents: ["Atlas", "SHURI"],
    lead: "Shuri",
    tasks: [
      { t: "Twitter OAuth + real posting", done: true },
      { t: "Bluesky AT Protocol + real posting", done: true },
      { t: "LinkedIn OAuth + real posting", done: true },
      { t: "Instagram OAuth flow built", done: true },
      { t: "History tab + hashtag suggestions + platform previews", done: true },
      { t: "AI Writer (Gemini-powered)", done: true },
      { t: "Instagram permissions config (Facebook Use Cases)", done: false },
      { t: "Threads / TikTok / YouTube / Facebook integrations", done: false },
      { t: "Scheduling backend (hosted DB)", done: false },
      { t: "Real analytics", done: false },
    ],
    blockers: ["Instagram blocked on Facebook Developer Portal"],
    link: { label: "Open Publish", href: "https://parallax-publish.vercel.app" },
  },
  {
    name: "Galactik Antics",
    slug: "galactik-antics",
    accent: "#00f0ff",
    status: "planning",
    desc: "AI art merch → Shopify store",
    priority: 3,
    priorityLabel: "HIGH",
    agents: ["Vee", "SHURI", "INK", "NOVA", "Aetherion"],
    lead: "Aetherion",
    tasks: [
      { t: "Batch A art matched to 5 designs", done: true },
      { t: "Source files copied to iPhone case folders", done: true },
      { t: "Pre-launch content (4 briefs, 7-day calendar)", done: true },
      { t: "Product lineup confirmed (13 cases, 5 posters, 5 tees)", done: true },
      { t: "10 architecture docs delivered", done: true },
      { t: "Weavy renders for 5 Batch A designs", done: false },
      { t: "Shopify store created — API token needed", done: false },
      { t: "Upload products + variants + pricing", done: false },
      { t: "Collector tier system (5 tiers, Shopify Flows)", done: false },
    ],
    blockers: ["Shopify API credentials", "GA art assets", "Timeline", "Kickstarter date"],
    link: { label: "Printful", href: "https://www.printful.com/dashboard" },
  },
  {
    name: "ClawGuard Pro",
    slug: "clawguard",
    accent: "#ef4444",
    status: "shipped",
    desc: "Security scanner — LIVE — $299/$799/$1499",
    priority: 4,
    priorityLabel: "HIGH",
    agents: ["Widow", "Atlas"],
    lead: "Widow",
    tasks: [
      { t: "12-domain security scanner", done: true },
      { t: "Product page + Stripe checkout (3 tiers)", done: true },
      { t: "GitHub repo public", done: true },
      { t: "CSP headers + API rate limiting + Firestore rules", done: true },
      { t: "Demo flow for sales", done: false },
    ],
    link: { label: "ClawGuard", href: "/clawguard" },
  },
  {
    name: "Parallax Studio",
    slug: "ramiche-studio",
    accent: "#a855f7",
    status: "blocked",
    desc: "Creative Services — Sprint $400 / Starter $1,500 / Pro $3,000 / Elite $6,000+",
    priority: 5,
    priorityLabel: "MED",
    agents: ["Vee", "MERCURY"],
    lead: "Mercury",
    tasks: [
      { t: "Landing page live", done: true },
      { t: "Inquiry form + checkout", done: true },
      { t: "4-platform DM scripts", done: true },
      { t: "Email sequences", done: true },
      { t: "SOPs + onboarding runbook", done: true },
      { t: "Stripe payments live", done: false },
      { t: "First client signed", done: false },
    ],
    blockers: ["STRIPE_SECRET_KEY", "Gmail env vars", "First UGC video", "First 5 warm DMs"],
    link: { label: "Studio", href: "/studio" },
  },
  {
    name: "Parallax",
    slug: "parallax",
    accent: "#e879f9",
    status: "shipped",
    desc: "Parent company — agents + skills marketplace",
    priority: 6,
    priorityLabel: "MED",
    agents: ["Atlas", "Aetherion"],
    lead: "Atlas",
    tasks: [
      { t: "9-page site live on Vercel", done: true },
      { t: "Agent marketplace + Claude Skills ($149-499)", done: true },
      { t: "White-label system (115 files, 20 agents, 7 bundles)", done: true },
      { t: "Artist roster page", done: false },
      { t: "Distribution pipeline", done: false },
    ],
    link: { label: "Site", href: "/" },
  },
  {
    name: "SCOWW",
    slug: "scoww",
    accent: "#22d3ee",
    status: "active",
    desc: "Swim meet — sponsors locked, Meta ad live",
    priority: 7,
    priorityLabel: "HIGH",
    agents: ["MICHAEL", "Vee"],
    lead: "Michael",
    tasks: [
      { t: "Sponsor packages locked", done: true },
      { t: "Meta ad campaign live", done: true },
      { t: "Event logistics finalized", done: false },
      { t: "Registration page", done: false },
    ],
    link: null,
  },
  {
    name: "Music Pipeline",
    slug: "music-pipeline",
    accent: "#f59e0b",
    status: "paused",
    desc: "Track production & release automation",
    priority: 8,
    priorityLabel: "LOW",
    agents: ["TheMAESTRO"],
    lead: "TheMAESTRO",
    tasks: [
      { t: "music.json system of record", done: true },
      { t: "Status dashboard", done: true },
      { t: "Stalled-track detection", done: false },
      { t: "Momentum reports", done: false },
    ],
    link: null,
  },
  {
    name: "Command Center",
    slug: "command-center",
    accent: "#3b82f6",
    status: "active",
    desc: "Mission Control dashboard — holographic ops hub",
    priority: 9,
    priorityLabel: "MED",
    agents: ["Atlas", "SHURI", "NOVA", "TRIAGE"],
    lead: "Atlas",
    tasks: [
      { t: "Main dashboard (agents, revenue, vitals)", done: true },
      { t: "3D Hangar workspace", done: true },
      { t: "Task Board (Kanban)", done: true },
      { t: "Calendar (Cron viz)", done: true },
      { t: "Project Tracker", done: true },
      { t: "Memory Browser", done: false },
      { t: "Doc Viewer", done: false },
      { t: "2D Pixel Office", done: false },
    ],
    link: { label: "Open", href: "/command-center" },
  },
];

/** Calculate progress % from tasks */
export function getProgress(project: SharedProject): number {
  if (project.tasks.length === 0) return 0;
  return Math.round((project.tasks.filter(t => t.done).length / project.tasks.length) * 100);
}
