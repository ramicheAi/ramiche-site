/** Command Center doc library — single source for `/docs` page and `/api/command-center/docs`. */

export interface CcDoc {
  title: string;
  category: string;
  author: string;
  date: string;
  summary: string;
  status: "active" | "draft" | "archived";
  path?: string;
}

export const CC_DOCUMENTS: CcDoc[] = [
  { title: "METTLE Beta Launch Plan", category: "Plans", author: "Atlas", date: "2026-03-01", summary: "Saint Andrew's Aquatics onboarding sequence, invite system, CSV import, setup wizard, coach quickstart guide.", status: "active" },
  { title: "Parallax Publish Roadmap", category: "Plans", author: "Atlas", date: "2026-02-27", summary: "3 platforms live (Twitter, Bluesky, LinkedIn). Instagram blocked on FB Developer Portal. Scheduling backend needed.", status: "active" },
  { title: "Galactik Antics Phase 1 Matrix", category: "Plans", author: "AETHERION", date: "2026-02-26", summary: "10 architecture docs, 30+ tasks across 7 tracks. Shopify + art assets pending.", status: "draft" },
  { title: "Ramiche Studio Pricing & Tiers", category: "Plans", author: "MERCURY", date: "2026-03-01", summary: "Sprint $400 / Starter $1,500 / Pro $3,000 / Elite $6,000+. Client acquisition kit complete.", status: "active" },
  { title: "Revenue Priority Stack", category: "Plans", author: "MERCURY", date: "2026-03-01", summary: "METTLE beta → Ramiche Studio first client → Parallax agent marketplace → Galactik Antics.", status: "active" },
  { title: "Agent Deployment SOP", category: "SOPs", author: "Atlas", date: "2026-02-24", summary: "SkillsBench-optimized. 2-3 focused modules per skill doc. Curated > auto-generated (+16.2%).", status: "active" },
  { title: "Build & Deploy Checklist", category: "SOPs", author: "Atlas", date: "2026-03-02", summary: "Build → commit → push → vercel --prod --force → curl verify → check age header.", status: "active" },
  { title: "Service Worker Ban Protocol", category: "SOPs", author: "SHURI", date: "2026-03-02", summary: "SWs BANNED on all Parallax/METTLE apps. Self-destruct pattern + inline head script.", status: "active" },
  { title: "Repo Verification Protocol", category: "SOPs", author: "Atlas", date: "2026-03-02", summary: "HARD RULE: verify correct repo via MEMORY.md before editing ANY product code.", status: "active" },
  { title: "THEMIS Governance Protocol", category: "SOPs", author: "Atlas", date: "2026-03-04", summary: "Atlas commands. Executors build. Themis governs. Token discipline + role enforcement.", status: "active" },
  { title: "Atlas Operational Protocol", category: "SOPs", author: "Atlas", date: "2026-03-04", summary: "<250 words, no narration, diff-only, one step per turn, max 2 agents per step.", status: "active" },
  { title: "Gateway Config", category: "Configs", author: "Atlas", date: "2026-03-04", summary: "19 agents, all cloud. Opus 4.6 for Atlas, DeepSeek V3.2 for execution squad, Kimi K2.5 for brand/social.", status: "active" },
  { title: "Cron Schedule", category: "Configs", author: "Atlas", date: "2026-03-04", summary: "17 cron events. Morning brief 7:15 AM, intel scans 8AM-12:15PM, overnight builder 1 AM.", status: "active" },
  { title: "Firebase Security Rules", category: "Configs", author: "SHURI", date: "2026-02-20", summary: "Firestore rules locked down for apex-athlete-73755. Coach/athlete/parent access patterns.", status: "active" },
  { title: "Agent Squad Performance Report", category: "Reports", author: "SIMONS", date: "2026-03-03", summary: "19 agents operational. Build success rate: 85%. Average task completion: 12 min.", status: "active" },
  { title: "Site Audit Results", category: "Reports", author: "Atlas", date: "2026-02-27", summary: "19 routes: 9 functional, 7 marketing-only, 2 partial, 1 fixed. /agents has real e2e.", status: "active" },
  { title: "ByteByteGo Compliance", category: "Reports", author: "SHURI", date: "2026-02-25", summary: "ALL 52 items implemented: security, performance, UX, infrastructure.", status: "active" },
  { title: "Amir Mushich Creative Arsenal", category: "Creative", author: "INK", date: "2026-03-02", summary: "50 Nano Banana Pro prompts for branding, products, mockups, apparel, typography, posters, icons.", status: "active" },
  { title: "Living Experience Philosophy", category: "Creative", author: "Atlas", date: "2026-02-28", summary: "Every screen = a place. Cardiac entrainment 72 BPM, biophilia, proprioception. Ambient particles mandatory.", status: "active" },
  { title: "METTLE Brand Guidelines v5", category: "Creative", author: "VEE", date: "2026-02-17", summary: "Forged M. Biblical colors: purple, scarlet, gold, blue. Gamified athlete progression.", status: "active" },
  { title: "Copyright Registration", category: "Legal", author: "Atlas", date: "2026-02-17", summary: "METTLE copyright DONE. Patent filing in progress at USPTO ($65 micro entity).", status: "active" },
  { title: "Trademark Filing Notes", category: "Legal", author: "Atlas", date: "2026-02-20", summary: "METTLE — Class 9+41+42 recommended. Filing pending.", status: "draft" },
  { title: "ClawGuard Pro Pricing", category: "Legal", author: "MERCURY", date: "2026-02-22", summary: "Security scanner live. $299/$799/$1499 tiers. GitHub + Stripe wired.", status: "active" },
];
