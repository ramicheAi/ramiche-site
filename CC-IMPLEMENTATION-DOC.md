# Command Center — Full Implementation Document for Cursor

**Date:** 2026-03-29
**Project:** ramiche-site (`/Users/admin/ramiche-site/`)
**Goal:** Wire every CC page to real-time data, eliminate all hardcoded/fake data, enable true agent control from the UI.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                     COMMAND CENTER (CC)                            │
│  Repo: /Users/admin/ramiche-site/                                 │
│  Live: ramiche-site.vercel.app/command-center                     │
│  Tunnel: command.parallaxvinc.com/command-center                  │
├───────────────────────────────────────────────────────────────────┤
│  Data Sources:                                                    │
│  1. Firestore (apex-athlete-73755) — bridge API                   │
│  2. Filesystem (workspace) — SSE endpoint                         │
│  3. OpenClaw Gateway — sessions, agents, crons                    │
│  4. agents/directory.json — agent config                          │
│  5. ~/.openclaw/cron/jobs.json — cron definitions                 │
│  6. ~/.openclaw/cron/history.json — cron execution log            │
│  7. yolo-builds/ — YOLO build folders                             │
│  8. memory/ — daily journals, MEMORY.md                           │
│  9. Parallax Site (parallax-site) — client inquiries              │
│  10. Meridian pipeline — finance data                             │
└───────────────────────────────────────────────────────────────────┘
```

### Key Files Map

| File | Path | Lines | Purpose |
|------|------|-------|---------|
| CC Main Dashboard | `src/app/command-center/page.tsx` | 1948 | Main dashboard with agents, stats, sidebar |
| Agents Page | `src/app/command-center/agents/page.tsx` | 989 | Agent directory, profiles, avatars |
| Chat Page | `src/app/command-center/chat/page.tsx` | 2474 | Agent communication system |
| Tasks Page | `src/app/command-center/tasks/page.tsx` | 672 | Task board / approval system |
| YOLO Page | `src/app/command-center/yolo/page.tsx` | 557 | YOLO builds gallery + approve/reject |
| Finance Page | `src/app/command-center/finance/page.tsx` | 1423 | Simons x Kiyosaki finance HQ |
| Observatory | `src/app/command-center/observatory/page.tsx` | 819 | Metrics, analytics, intelligence |
| Settings | `src/app/command-center/settings/page.tsx` | 272 | Agent config, system settings |
| Health | `src/app/command-center/health/page.tsx` | 156 | System health + scanning |
| Sales | `src/app/command-center/sales/page.tsx` | 205 | Mercury + Haven sales ops |
| Strategy | `src/app/command-center/strategy/page.tsx` | 142 | Strategic planning |
| Content | `src/app/command-center/content/page.tsx` | 332 | Content pipeline |
| Wellness | `src/app/command-center/wellness/page.tsx` | 148 | Selah wellness |
| Studio | `src/app/command-center/studio/page.tsx` | 164 | Baba Studio + music |
| Nerve Center | `src/app/command-center/nerve-center/page.tsx` | 18 | Iframe to YOLO build |
| Legal | `src/app/command-center/legal/page.tsx` | 165 | Themis legal |
| Fabrication | `src/app/command-center/fabrication/page.tsx` | 520 | Nova 3D printing |
| Memory | `src/app/command-center/memory/page.tsx` | 571 | Memory viewer |
| Signal Wire | `src/app/command-center/signal-wire/page.tsx` | 459 | Communication hub |
| Calendar | `src/app/command-center/calendar/page.tsx` | 222 | Schedule |
| Terminal | `src/app/command-center/terminal/page.tsx` | 207 | CLI interface |

### API Routes Map

| Route | Path | Purpose |
|-------|------|---------|
| Bridge | `src/app/api/bridge/route.ts` | Firestore proxy (290 lines) |
| SSE | `src/app/api/command-center/sse/route.ts` | Real-time event stream (343 lines) |
| Agents | `src/app/api/command-center/agents/route.ts` | Agent directory from filesystem |
| Chat | `src/app/api/command-center/chat/route.ts` | Chat messages |
| Crons | `src/app/api/command-center/crons/route.ts` | Cron job data |
| YOLO Builds | `src/app/api/command-center/yolo-builds/route.ts` | YOLO build listing |
| YOLO Approve | `src/app/api/command-center/yolo-approve/route.ts` | Build approval |
| Content | `src/app/api/command-center/content/route.ts` | Content pipeline |
| Memory | `src/app/api/command-center/memory/route.ts` | Memory files |
| Meridian | `src/app/api/command-center/meridian/route.ts` | Finance data |
| Projects | `src/app/api/command-center/projects/route.ts` | Project tracking |
| Security | `src/app/api/command-center/security/route.ts` | Security scans |
| Activity | `src/app/api/command-center/activity/route.ts` | Activity log |
| Oracle | `src/app/api/command-center/oracle/route.ts` | Agent oracle chat |
| Studio Inquiry | `src/app/api/studio-inquiry/route.ts` | Client intake forms |

### External Systems

| System | Location | Purpose |
|--------|----------|---------|
| OpenClaw Gateway | localhost (this machine) | Agent orchestration, sessions, cron |
| Parallax Site | `/Users/admin/parallax-site/` | Public website, client intake |
| Parallax Site Live | `parallax-site-ashen.vercel.app` | Production client-facing site |
| Firestore | apex-athlete-73755 | Shared data store |
| agents/directory.json | `~/.openclaw/workspace/agents/directory.json` | Source of truth for agent config |
| Cron Jobs | `~/.openclaw/cron/jobs.json` | Cron definitions |
| Cron History | `~/.openclaw/cron/history.json` | Execution log |
| YOLO Builds | `~/.openclaw/workspace/yolo-builds/` | 128+ build folders |

---

## TASK 1: Chat System — Full Real-Time Wiring

**File:** `src/app/command-center/chat/page.tsx` (2474 lines)

### Current State
- Chat page has UI for messaging agents
- Uses Supabase for some persistence
- May have hardcoded demo messages

### Required Changes
1. **Wire to OpenClaw sessions_send** — when Ramon sends a message in the CC chat, it must actually reach the agent via the OpenClaw Gateway API
2. **Wire agent responses back** — use SSE or WebSocket to stream agent responses in real-time
3. **All 20 agents must be selectable** — Atlas, SHURI, TRIAGE, PROXIMON, AETHERION, SIMONS, MERCURY, VEE, INK, ECHO, HAVEN, WIDOW, Dr Strange, KIYOSAKI, MICHAEL, SELAH, PROPHETS, TheMAESTRO, NOVA, THEMIS
4. **Message history** — persist via Supabase or Firestore, load on page open
5. **Agent status indicators** — show which agents are active/idle/offline in real-time via SSE

### Implementation Notes
- OpenClaw Gateway API is available locally. Check `openclaw --help` for API endpoints
- The SSE endpoint at `/api/command-center/sse` already streams agent data every 5s — extend it to include chat messages
- Agent session keys can be found via `sessions_list` tool or from `agents/directory.json`

### Context Files
- `src/app/api/command-center/chat/route.ts` — existing chat API
- `~/.openclaw/workspace/agents/directory.json` — agent IDs and config

---

## TASK 2: Agents Page — Live Data + Editable + Unique Avatars

**File:** `src/app/command-center/agents/page.tsx` (989 lines)

### Current State
- Shows agent cards with some live data from `/api/command-center/agents`
- Avatars may have duplicates (TRIAGE and THEMIS share same avatar)
- No edit capability — read-only display
- Missing Archivist agent

### Required Changes

#### 2a. Live Agent Data (all fields from directory.json)
- Read from `agents/directory.json` via the agents API
- Show: name, model, provider, role, capabilities, skills, escalation level, status
- Update every 10s via polling or SSE

#### 2b. Editable Agent Config
- Each agent card should have an "Edit" button
- Editable fields: model, role, capabilities, skills
- On save, write changes back via a new API endpoint: `POST /api/command-center/agents` that updates `agents/directory.json`
- Model field should be a dropdown with available models: `claude-opus-4-6`, `claude-sonnet-4-5-20250929`, `kimi-k2.5`, `qwen3:14b`, `qwen3:8b`, `gemma2:9b`, `llama3.1:8b`, `deepseek-v3.2`, `gemini-3.1-pro-preview`

#### 2c. Fix Duplicate Avatars
- TRIAGE and THEMIS currently share the same avatar — they need distinct ones
- Each agent needs a unique, themed avatar matching their domain:
  - Atlas: compass/globe (gold) 🧭
  - TRIAGE: medical cross/stethoscope (green)
  - THEMIS: scales of justice (blue/silver)
  - SHURI: lightning bolt/circuit (emerald)
  - PROXIMON: architecture/blueprint (cyan)
  - AETHERION: eye/prism (iridescent)
  - SIMONS: chart/graph (cyan)
  - MERCURY: winged helmet/speed (green)
  - VEE: megaphone/brand mark (coral)
  - INK: pen/quill (violet)
  - ECHO: wave/ripple (teal)
  - HAVEN: shield/heart (sky blue)
  - WIDOW: spider web/lock (dark red)
  - Dr Strange: eye of agamotto/portal (purple)
  - KIYOSAKI: money bag/chart (gold)
  - MICHAEL: stopwatch/swimmer (navy)
  - SELAH: lotus/brain (lavender)
  - PROPHETS: book/flame (amber)
  - TheMAESTRO: music note/headphones (pink)
  - NOVA: 3D cube/printer (orange)
  - ARCHIVIST: file cabinet/index (grey) — MUST be added as a new agent

#### 2d. Add Archivist Agent
- Archivist is a cron-based indexer, not a session agent
- Display as a special card with "SYSTEM" tier
- Show last index run time from `memory/codebase-index.md`

### Context Files
- `~/.openclaw/workspace/agents/directory.json` — source of truth
- Avatar assets may need generation via Gemini/DALL-E or SVG icons

---

## TASK 3: Task Board — Real-Time + Actionable Approve/Start/Reject

**File:** `src/app/command-center/tasks/page.tsx` (672 lines)

### Current State
- Shows task cards
- May have hardcoded task data
- Approve/reject buttons exist but may not trigger real agent actions

### Required Changes

#### 3a. Live Task Data
- Read tasks from `~/.openclaw/workspace/projects/*/TASKS.md` files
- Also read from any Firestore task collections
- Poll every 10s or use SSE

#### 3b. Approve/Start/Reject Actions That Actually Work
- **Approve:** Calls OpenClaw Gateway to spawn the relevant agent with the task. Use `sessions_spawn` or `sessions_send` to the target agent. The task prompt must include the full context from the task card.
- **Start:** Same as approve but marks the task as "in_progress" in the TASKS.md file
- **Reject:** Writes rejection reason to memory log (`memory/YYYY-MM-DD.md`) with the task details and reason. Updates task status to "rejected" in TASKS.md.

#### 3c. Task Creation from UI
- "New Task" button that creates a task with: title, description, priority (P0/P1a/P1b/P2), assigned agent, due date
- Writes to the appropriate `projects/{slug}/TASKS.md`

### Implementation Notes
- The OpenClaw Gateway exposes session management. For spawning agents, create a new API route: `POST /api/command-center/tasks/action` that shells out to `openclaw` CLI or calls the Gateway API directly
- Priority tiers from AGENTS.md: P0 (URGENT), P1a (BUILD), P1b (ADVISE), P2 (INVESTMENT)

### Context Files
- `~/.openclaw/workspace/projects/*/TASKS.md` — task files per project
- `~/.openclaw/workspace/AGENTS.md` — priority tier definitions

---

## TASK 4: Cron Jobs — Audit + Fix + Efficient Execution

### Current State
- Cron definitions in `~/.openclaw/cron/jobs.json`
- Execution history in `~/.openclaw/cron/history.json`
- SSE endpoint already reads and streams cron data
- Some crons may be stale or misconfigured

### Required Changes

#### 4a. Cron Audit
- Read ALL cron jobs from `~/.openclaw/cron/jobs.json`
- Cross-reference with execution history to find: stale (never ran), failing (last 3 runs failed), disabled
- Display audit results on the Settings or Health page

#### 4b. Cron Management UI
- Show all crons with: name, schedule, last run, last result, enabled/disabled toggle
- Toggle enabled/disabled should write back to `jobs.json`
- "Run Now" button that triggers immediate execution
- New API route: `POST /api/command-center/crons/action` with actions: enable, disable, run-now

#### 4c. Fix Broken Crons
- Audit current schedule from MEMORY.md cron schedule section
- Ensure all listed crons actually exist in jobs.json and are enabled
- Fix model assignments per the agent model table in MEMORY.md

### Context Files
- `~/.openclaw/cron/jobs.json` — cron definitions
- `~/.openclaw/cron/history.json` — execution log
- MEMORY.md "Cron Schedule" section — expected schedule

---

## TASK 5: System Health — Full Ecosystem Wiring + ClawGuard Scan

**File:** `src/app/command-center/health/page.tsx` (156 lines)

### Current State
- Shows basic agent status + 3 service checks (hitting internal API routes as proxy)
- "REFRESH" button just re-polls the same endpoints
- No actual system scanning or ClawGuard integration

### Required Changes

#### 5a. Full System Health Dashboard
Wire to the SSE endpoint which already provides:
- CPU cores, model, load average
- Memory total/free/used/%
- Disk total/used/available/%
- System uptime
- Active processes (OpenClaw, Claude, Node)

#### 5b. Service Health Checks (real external services)
Check actual services, not just internal API routes:
- Vercel deployment status (curl ramiche-site.vercel.app)
- Parallax site (curl parallax-site-ashen.vercel.app)
- Firebase/Firestore connectivity
- Ollama on M5 (http://ramons-macbook-pro:11434/api/tags)
- Tailscale network status
- OpenClaw Gateway status

#### 5c. RE-SCAN Button → ClawGuard Pro Integration
- When "RE-SCAN" is clicked, run ClawGuard Pro security scan
- ClawGuard Pro is at: Check for `clawguard` CLI or the ClawGuard project
- ClawGuard product tiers: $299 (Scan), $799 (Team), $1499 (Enterprise)
- The scan should check: open ports, SSL certs, dependency vulnerabilities, env file exposure, API key leaks
- Display results in a security panel with severity levels

#### 5d. Gateway Controls
- Show OpenClaw Gateway status (running/stopped)
- Buttons: Restart Gateway, Run Doctor
- These call `openclaw gateway restart` and `openclaw doctor` via a new API route

### Context Files
- `src/app/api/command-center/sse/route.ts` — already has system vitals
- ClawGuard project location: check `/Users/admin/ramiche-site/src/app/clawguard/` or workspace

---

## TASK 6: Settings Page — Functional Controls

**File:** `src/app/command-center/settings/page.tsx` (272 lines)

### Current State
- Shows agent cards (read-only) with stale hardcoded DEFAULT_AGENTS array (line 45-66)
- System tab shows static hardcoded values
- No actual control functionality

### Required Changes

#### 6a. Remove Hardcoded DEFAULT_AGENTS
- Delete the `DEFAULT_AGENTS` array (lines 45-66) — it has wrong models (shows "deepseek-v3.2" for agents that are now on Sonnet 4.5)
- Load agent data purely from `/api/command-center/agents` endpoint
- Show loading skeleton until data arrives

#### 6b. System Controls
Replace static system info with actionable controls:
- **Restart OpenClaw:** Button that calls `POST /api/command-center/settings/action` → runs `openclaw gateway restart`
- **Run Doctor:** Button that runs `openclaw doctor` and displays output
- **Model Override:** Dropdown to change the default model for the session
- **Gateway Config:** Show current config values, allow editing key settings
- API route needed: `POST /api/command-center/settings/action` with actions: restart-gateway, run-doctor, update-config

#### 6c. Agent Model Updates (live)
- The agent model table in MEMORY.md is the source of truth:
  - Atlas: Opus 4.6 (claude-max)
  - SHURI, NOVA, TRIAGE, SIMONS, MERCURY, Dr Strange, HAVEN, INK, KIYOSAKI: Sonnet 4.5 (claude-max)
  - AETHERION: Gemini 3.1 Pro (OpenRouter)
  - VEE, PROPHETS: Kimi K2.5 (OpenRouter)
  - ECHO, MICHAEL, WIDOW, SELAH, TheMAESTRO: qwen3:14b (Ollama local)
  - THEMIS: Sonnet 4.5 (claude-max)
- Editing an agent's model here should update `agents/directory.json`

---

## TASK 7: YOLO Builds — Real-Time + Actionable Approve/Reject

**File:** `src/app/command-center/yolo/page.tsx` (557 lines)

### Current State
- Lists builds from `/api/command-center/yolo-builds` API
- Approve button calls `/api/command-center/yolo-approve` but only writes to a JSON file — does NOT notify agents
- Many builds can't be opened (97 of 115 never deployed to Vercel)
- Not updating in real-time

### Required Changes

#### 7a. Real-Time Updates
- Subscribe to SSE endpoint which already emits `yolo` events every 30s
- Show new builds appearing live without page refresh

#### 7b. Fix Build Viewing
The YOLO builds API currently reads from filesystem on tunnel but from `public/yolo-builds/` on Vercel. Fix:
- Move all YOLO build metadata to Firestore (same pattern as bridge sync)
- Each build's `index.html` should be deployed to Vercel as a standalone deployment OR served via a proxy route
- Quick fix: create a deploy script that batch-deploys all undeployed builds

#### 7c. Approve → Actually Pings Agent
When Ramon clicks "Approve" with a tier selection:
1. Write approval to Firestore (not just local JSON)
2. Call OpenClaw Gateway to `sessions_send` or `sessions_spawn` the relevant agent with:
   - The build name and folder
   - The assigned tier (Internal Tool / Integration / Product)
   - Instructions to implement based on tier
3. Update the build status in real-time

#### 7d. Reject → Logs With Reason
When Ramon clicks "Reject":
1. Show a modal for rejection reason
2. Write to `memory/YYYY-MM-DD.md` with: build name, agent, reason, timestamp
3. Notify the agent via `sessions_send` with the rejection reason for learning
4. Update build status to "rejected"

#### 7e. Tier System Implementation
Tiers from the CC UI:
- **Internal Tool:** Deploy to internal tooling, used by agents only
- **Integration:** Integrate into existing products (METTLE, Parallax Site, etc.)
- **Product:** Launch as standalone product/feature

### Context Files
- `src/app/api/command-center/yolo-builds/route.ts` — current builds API (reads filesystem)
- `src/app/api/command-center/yolo-approve/route.ts` — current approve API (writes JSON)
- `~/.openclaw/workspace/yolo-builds/` — 128+ build folders
- Builds have: `index.html`, optional `meta.json`, optional `README.md`

---

## TASK 8: Nerve Center — Restore v1 Dark Mode Version

**File:** `src/app/command-center/nerve-center/page.tsx` (18 lines)

### Current State
- Just an iframe pointing to `/yolo-builds/2026-03-17-nerve-center/index.html`
- Ramon wants the v1 version with dark mode, colorful bars, and cool layout

### Required Changes
1. Find the v1 Nerve Center build: `~/.openclaw/workspace/yolo-builds/2026-03-17-nerve-center/`
2. Check if there are multiple versions — find the dark mode one with colorful bars
3. Either:
   a. Update the iframe to point to the correct version
   b. Or rebuild the nerve center page natively (preferred) with the dark mode design, wired to the SSE endpoint for live data

### Context Files
- `~/.openclaw/workspace/yolo-builds/2026-03-17-nerve-center/index.html` — current build
- Check git history for earlier versions if the current one is wrong

---

## TASK 9: Finance HQ — Fix + Wire Meridian + Build Out Kiyosaki

**File:** `src/app/command-center/finance/page.tsx` (1423 lines)

### Current State
- Has tabs: overview, portfolio, signals, risk, oracle, cashflow, meridian
- Meridian tab tries to fetch from `/api/command-center/meridian`
- Page may not open at all (likely build error or data fetch failure)

### Required Changes

#### 9a. Fix Page Loading
- Check for any build errors in the finance page
- Ensure all data fetches have proper error handling and fallbacks
- Remove any hardcoded/fake data — show "No data" states instead

#### 9b. Wire Meridian Pipeline
- Meridian is the finance data pipeline
- API: `src/app/api/command-center/meridian/route.ts`
- Ensure it reads from the actual Meridian data source
- Display: portfolio positions, equity, capital, returns, trade history

#### 9c. Kiyosaki Build-Out
- Kiyosaki is the financial intelligence agent (Sonnet 4.5)
- The finance page should show Kiyosaki's analysis, recommendations, alerts
- Wire to real agent output from `memory/` files or Firestore
- Sections needed:
  - Cash flow analysis (actual Stripe/revenue data)
  - Asset tracking
  - Financial alerts from Kiyosaki's cron runs
  - Investment signals from Simons

#### 9d. No Fake Data
- Remove ALL placeholder/demo data
- Every number should come from a real source (Stripe API, Meridian, agent output)
- If no data exists yet, show empty states with "Awaiting first data sync"

### Context Files
- `src/app/api/command-center/meridian/route.ts` — Meridian API
- `~/.openclaw/workspace/memory/` — agent daily logs contain finance analysis
- Stripe integration: check `src/app/api/stripe/` for existing endpoints

---

## TASK 10: Team Pages — Sales, Strategy, Content, Wellness

### Current State
| Page | File | Lines | Status |
|------|------|-------|--------|
| Sales | `sales/page.tsx` | 205 | Has pipeline data from JSON file, hardcoded products, agent status polling |
| Strategy | `strategy/page.tsx` | 142 | Likely minimal/placeholder |
| Content | `content/page.tsx` | 332 | Has some content pipeline data |
| Wellness | `wellness/page.tsx` | 148 | Likely minimal/placeholder |

### Required Changes (apply to ALL four pages)

#### 10a. Wire to Real Agent Data
Each page should fetch its team's agents from `/api/command-center/agents`:
- **Sales:** Mercury, Haven, Kiyosaki
- **Strategy:** Dr Strange, Vee, Atlas
- **Content:** Ink, Echo, Vee, Aetherion
- **Wellness:** Selah, Michael, Prophets

#### 10b. Real Activity Data
- Each team page should show recent actions by its agents from `memory/YYYY-MM-DD.md`
- Parse daily memory files for entries tagged with the relevant agent names
- Show as an activity feed with timestamps

#### 10c. Sales Page Specific
- Pipeline data comes from `src/data/sales-pipeline.json` — this is OK if it's manually maintained
- Wire Stripe webhook data to show real revenue: `src/app/api/stripe/webhook/route.ts` exists
- Products list should match MEMORY.md product catalog exactly

#### 10d. Content Page Specific
- Wire to content pipeline at `~/.openclaw/workspace/content/` if it exists
- Show drafts, reviews, approvals, posted content
- Connect to Parallax Publish for cross-posting status

#### 10e. Proactive Revenue Finding
- Each team page should have a "Revenue Opportunities" section
- Populated by agent analysis stored in memory or Firestore
- Sales: leads, outreach opportunities
- Content: content that could be monetized
- Strategy: market gaps, new product ideas

#### 10f. No Fake Data
- Remove all hardcoded demo/placeholder data
- If a section has no real data, show "No data — agents will populate this during their next run"

### Context Files
- `src/data/sales-pipeline.json` — sales pipeline data
- `~/.openclaw/workspace/memory/` — agent daily logs
- `~/.openclaw/workspace/content/` — content pipeline (if exists)

---

## TASK 11: Design Consistency — Legal, Wellness, Agent Pricing

### Pages Needing Redesign
- `legal/page.tsx` (165 lines)
- `wellness/page.tsx` (148 lines)
- Agent pricing page (find location)

### Current State
- These pages may use different design patterns than the main CC pages
- The CC standard design uses: black background (#000000), ParticleField component, gold accents (#C9A84C), green status (#22c55e), card-based layout with `rgba(0,0,0,0.95)` backgrounds and `rgba(255,255,255,0.1)` borders

### Design Standards (from CC main page)
```
Background: #000000
Text: #e5e5e5
Secondary text: #737373
Tertiary: #525252
Accent gold: #C9A84C
Status green: #22c55e
Warning amber: #f59e0b
Error red: #ef4444
Cards: background rgba(0,0,0,0.95), border 1px solid rgba(255,255,255,0.1)
Card shadows: 0 0 24px {accent}15, 0 8px 32px rgba(0,0,0,0.4)
Section headers: fontSize 12, fontWeight 800, letterSpacing 0.15em, uppercase
Labels: fontSize 10-11, letterSpacing 0.1-0.2em, uppercase
Border radius: 12-16px for cards
Grid: repeat(auto-fill, minmax(280px, 1fr))
Component: ParticleField (always include)
Back link: ← COMMAND CENTER (11px, tracking 0.12em)
```

### Required Changes
- Audit all three pages against these design standards
- Rewrite any that don't match
- Ensure consistent sidebar navigation pattern if used

---

## TASK 12: Observatory — Full Real-Time Data

**File:** `src/app/command-center/observatory/page.tsx` (819 lines)

### Current State
- Shows metrics and analytics panels
- May have hardcoded or demo data

### Required Changes
1. Wire all metrics to real data sources:
   - Agent spawn counts (from cron history)
   - Task completion rates (from TASKS.md files)
   - YOLO build production rate (from yolo-builds directory)
   - System uptime (from SSE vitals)
   - Git commit velocity (from SSE commits)
   - Token usage / costs (from OpenClaw usage tracking if available)
2. Real-time updates via SSE subscription
3. Charts should use actual historical data, not generated/demo data
4. Time range filters (24h, 7d, 30d) with real data backing

### Context Files
- SSE endpoint provides: commits, vitals, sessions, yoloBuilds, cronHistory, gitActivity
- Parse `memory/YYYY-MM-DD.md` files for historical agent activity

---

## TASK 13: Studio — Wire to Parallax Website Intake

**File:** `src/app/command-center/studio/page.tsx` (164 lines)

### Current State
- Shows TheMAESTRO status, signed artists roster, production tools
- Hardcoded SIGNED_ARTISTS and STUDIO_TOOLS arrays
- No connection to client inquiries from the Parallax website

### Required Changes

#### 13a. Wire Client Inquiries
The Parallax website has:
- **Studio inquiry form:** `parallax-site/src/app/api/studio-inquiry/route.ts` — saves to `data/studio-inquiries.json`
- **Music intake:** `parallax-site/src/app/api/music/intake/route.ts`
- **Setup service:** `parallax-site/src/app/setup/page.tsx`

When clients submit work through the Parallax website:
1. Inquiry should be saved to Firestore (shared between sites)
2. CC Studio page should poll Firestore for new inquiries
3. Show a "Client Inquiries" section with: client name, service tier, date, status
4. Notification badge when new inquiry arrives

#### 13b. Project Pipeline
- Kanban board for studio projects: Inquiry → Accepted → In Progress → Review → Delivered
- Each project card shows: client, tier ($400/$1500/$3000/$6000+), assigned agent, deadline
- Status updates from agent memory logs

#### 13c. Parallax Website Integration Context
The Parallax site (`/Users/admin/parallax-site/`) has these relevant pages:
- `/studio` — Studio services page (client-facing)
- `/music` — Music page
- `/intake` — Client intake form
- `/setup` — Setup service page
- `/agents` — Agent marketplace
- `/clawguard` — ClawGuard product page

**Data flow:**
```
Client visits parallax-site → fills intake form → saves to Firestore
                                                       ↓
CC Studio page ← polls Firestore → shows new inquiry with notification
                                       ↓
Ramon approves → agent spawned → project starts → status tracked in CC
```

#### 13d. Revenue Tracking
- Show total studio revenue (from Stripe)
- Revenue by tier, by month
- Client satisfaction data (if collected)

### Context Files
- `parallax-site/src/app/api/studio-inquiry/route.ts` — inquiry endpoint
- `parallax-site/src/app/api/music/intake/route.ts` — music intake
- `ramiche-site/src/app/api/studio-inquiry/route.ts` — also exists in ramiche-site
- Firebase project: apex-athlete-73755

---

## TASK 14: App Builder — Full Pipeline to Apple App Store

**File:** `src/app/command-center/app-builder/page.tsx` (447 lines)

### Current State
- Has a 5-stage pipeline UI: Scaffold → Preview → Build → TestFlight → App Store
- All stages are "locked" — none functional
- Prerequisites listed (Apple Dev Program, App Store Connect API Key, EAS CLI, Expo project) all show "not-configured"
- Pure UI shell — zero wiring to any build system

### Required Changes

#### 14a. Wire Prerequisites Checker
- On page load, run actual checks:
  - Apple Developer Program: check if `APPLE_DEVELOPER_TEAM_ID` env var exists or if Apple developer certs are in Keychain (`security find-identity -v -p codesigning`)
  - App Store Connect API Key: check for `APP_STORE_CONNECT_API_KEY` env var or file at `~/.appstoreconnect/private_keys/`
  - EAS CLI: run `which eas` or check `node_modules/.bin/eas`
  - Expo: check for `app.json` or `app.config.js` in project dir
- New API route: `GET /api/command-center/app-builder/status` that runs these checks and returns real status

#### 14b. Scaffold Stage (Describe → Generate)
- Text input for app description already exists
- On submit: spawn a coding agent (Claude Code or Codex) via OpenClaw to:
  1. Generate an Expo project scaffold based on the description
  2. Save to a new directory under `~/.openclaw/workspace/app-builds/{slug}/`
  3. Return the generated file tree
- Show generated file tree in the UI with preview capability

#### 14c. Preview Stage
- Run `npx expo start --web` in the generated project
- Display the preview URL in an iframe or link
- Alternative: use Expo Go QR code for mobile preview

#### 14d. Build Stage
- Run `eas build --platform ios --profile production`
- Stream build logs via SSE
- Show build status (queued → building → complete/failed)
- Display build artifact URL when done

#### 14e. TestFlight Stage
- Run `eas submit --platform ios --profile production`
- This uploads the IPA to App Store Connect → TestFlight
- Show submission status and TestFlight link once available

#### 14f. App Store Stage
- Provide the final checklist: screenshots, metadata, review notes
- Link to App Store Connect for manual submission (Apple requires human review)
- Store submission history in Firestore

### How Successful Teams Do This (Reference)
- **Expo/EAS workflow** (https://docs.expo.dev/build/introduction/) — the industry standard for React Native → App Store. Expo handles code signing, provisioning profiles, and cloud builds. This is what Vercel is to web deploys — but for mobile.
- **Fastlane** (https://fastlane.tools/) — alternative for native iOS. More complex but full control. Used by Shopify, Airbnb, Twitter.
- The key insight: **EAS automates the hardest part** (Apple code signing). With API keys configured, the flow is: `eas build` → `eas submit` → TestFlight → App Store review.

### Context Files
- `src/app/command-center/app-builder/page.tsx` — current page
- Expo docs: https://docs.expo.dev/
- EAS Build: https://docs.expo.dev/build/setup/
- EAS Submit: https://docs.expo.dev/submit/introduction/

---

## TASK 15: Fabrication — Full 3D Printing Dashboard + Approved YOLO Builds

**File:** `src/app/command-center/fabrication/page.tsx` (520 lines)

### Current State
- Has interfaces for PrintJob, Printer, STLFile — but all arrays are empty
- Fetches Nova agent status from `/api/command-center/agents` (works)
- Print queue, printer status, STL pipeline — all empty, no data source
- No connection to actual Bambu Lab printer or YOLO builds approved for printing

### Required Changes

#### 15a. Wire to Bambu Lab Printer
- The `bambu-local` skill connects to Bambu Lab printers via MQTT locally
- The `bambu-studio-ai` skill has the full pipeline: search → generate → slice → print → monitor
- New API route: `GET /api/command-center/fabrication/printer-status` that:
  1. Calls Bambu Lab MQTT API to get printer status (online/offline, current job, temperatures, progress)
  2. Returns real printer data
- Show real printer card with: model, status, nozzle temp, bed temp, current job progress bar

#### 15b. Import Approved 3D Printing YOLO Builds
There are **13 approved/existing 3D printing YOLO builds**:
```
2026-03-02-print-failure-analyzer
2026-03-02-printflow-storefront
2026-03-05-print-queue-dashboard
2026-03-09-bambu-live-monitor
2026-03-25-print-catalog
2026-03-26-print-cost-comparison
2026-03-27-print-job-estimator
2026-03-27-printflow-job-tracker
2026-03-28-print-battle-arena
2026-03-28-print-design-studio
2026-03-28-print-finish-library
2026-03-28-print-time-machine
2026-03-29-print-material-stress-tester
```
- These should appear in a "Print Tools" gallery on the fabrication page
- Each tool is a standalone app (index.html) — link to its deployed Vercel URL
- Categorize by function: monitoring, estimation, design, analysis

#### 15c. Print Queue Management
- New API route: `POST /api/command-center/fabrication/print` that:
  1. Accepts STL file upload or URL
  2. Sends to Bambu Lab for slicing via `bambu-studio-ai` skill
  3. Queues print job with estimated time and material usage
- Show queue as kanban: Queued → Slicing → Printing → Complete
- Each job card: name, material, estimated time, progress %, started at

#### 15d. STL Pipeline
- Upload STL files via drag-and-drop
- Preview STL in 3D viewer (use Three.js STLLoader)
- Auto-analyze: dimensions, volume, estimated print time, recommended material
- The `printpal-3d` skill can generate STL from text prompts — wire a "Generate from Text" button

#### 15e. End-to-End Flow
```
Text prompt OR STL upload → PrintPal generates/accepts STL
  → Bambu Studio AI slices → Preview in 3D viewer
  → User approves → Sends to Bambu Lab printer via MQTT
  → Real-time progress on fabrication dashboard
  → Complete notification to Ramon via Telegram
```

### Context Files
- Skill: `/Users/admin/openclaw-src/skills/bambu-local/SKILL.md` — MQTT printer control
- Skill: `/Users/admin/.openclaw/workspace/skills/bambu-studio-ai/SKILL.md` — full pipeline
- Skill: `/Users/admin/.openclaw/workspace/skills/printpal-3d/SKILL.md` — STL generation
- YOLO builds: `~/.openclaw/workspace/yolo-builds/2026-03-*-print*` (13 builds)

---

## TASK 16: Projects Page — Real-Time Updates After Every Task

**File:** `src/app/command-center/projects/page.tsx` (203 lines)

### Current State
- Already fetches live data from `/api/command-center/projects` (reads workspace TASKS.md files)
- Shows project cards with progress bars, status, agents, blockers
- Has filter bar and navigation
- Polls every 30s via `setInterval`

### Required Changes

#### 16a. Real-Time Updates (SSE)
- Replace 30s polling with SSE subscription to `/api/command-center/sse`
- The SSE endpoint already emits project-related data — extend it if needed
- When an agent completes a task and commits, the project card should update within seconds
- Add a "Last updated" timestamp per project showing real commit time

#### 16b. Task-Level Granularity
- Clicking a project card should expand to show ALL tasks from its `TASKS.md`
- Each task shows: description, status (pending/in-progress/done), assigned agent, completion date
- Task checkboxes that work — checking a task writes to the project's `TASKS.md` via API
- New API route: `POST /api/command-center/projects/task-update` that edits TASKS.md files

#### 16c. Project Detail View
- Each project should be clickable → opens a detail page or modal with:
  - Full task list with checkboxes
  - Git commit history for that project (filter `git log` by project path)
  - Active agent sessions working on the project
  - Blockers with resolution status
  - Links to live URLs (Vercel deployments)
  - File tree for the project directory

#### 16d. Project-Relevant Resources
- Show related YOLO builds that were approved and integrated
- Show related memory entries (search daily logs for project name)
- Show related Firestore documents

### Context Files
- `src/app/api/command-center/projects/route.ts` — current projects API
- `src/app/command-center/shared-projects.ts` — project metadata
- `~/.openclaw/workspace/projects/*/TASKS.md` — task files per project

---

## TASK 17: Memory/Journal — All Agents Logging, Full Dropdown

**File:** `src/app/command-center/memory/page.tsx` (571 lines)

### Current State
- Journal viewer with date picker and agent filter dropdown
- Already parses `memory/YYYY-MM-DD.md` files and extracts entries by agent
- Has AGENT_META for 20 agents with colors and emojis
- Category detection for color-coding entries (DEPLOY, FIX, BUILD, RULE, etc.)

### Required Changes

#### 17a. All Agents in Dropdown
- Current AGENT_META has 20 agents — verify ALL are listed:
  Atlas, SHURI, NOVA, INK, MERCURY, TRIAGE, AETHERION, PROPHETS, DR STRANGE, SIMONS, VEE, ECHO, HAVEN, WIDOW, MICHAEL, SELAH, KIYOSAKI, TheMAESTRO, THEMIS, PROXIMON
- **Add missing: ARCHIVIST** — color: #9CA3AF, bg: #9CA3AF18, emoji: 📁
- Each agent MUST appear in the dropdown even if they have zero entries for that day (show "No entries" state)

#### 17b. Enforce Agent Logging — System-Level
This is NOT just a UI task — it requires enforcing that agents actually write to daily memory:
- **Cron enforcement:** Add a nightly cron that audits each agent's logging:
  1. Read `memory/YYYY-MM-DD.md`
  2. Check which agents have entries vs. which agents were active (from session history)
  3. Flag agents with zero entries as "NON-COMPLIANT"
  4. Display compliance dashboard on the memory page
- **Agent-level enforcement:** Update `AGENTS.md` Rule 13 (already exists) — every `sessions_spawn` prompt MUST include: "Log your work to memory/YYYY-MM-DD.md with timestamp and agent name"
- **Pre-spawn injection:** Modify the spawn pipeline to automatically append logging instructions

#### 17c. Version Numbers and Revert Points
- Each memory entry that involves code changes should include:
  - Git commit hash (short, 7 chars)
  - Files changed
  - A "revert to this point" button that shows the `git revert` command
- New API route: `GET /api/command-center/memory/commits?date=YYYY-MM-DD` that returns commits for that day
- Display commit hashes inline with journal entries

#### 17d. Agent Conversation Logs
- Ramon wants to see every agent's full conversation, not just summaries
- New API route: `GET /api/command-center/memory/agent-sessions?agent=SHURI&date=YYYY-MM-DD`
- This reads from OpenClaw session transcripts (check `~/.openclaw/sessions/` or session history API)
- Display as expandable conversation threads under each agent's section

#### 17e. Knowledge Base Growth Visualization
- Show a chart of total memory entries over time (daily count)
- Show agent contribution breakdown (who logs the most)
- Show knowledge categories growing (DEPLOY, FIX, BUILD, etc.)

### Context Files
- `src/app/command-center/memory/page.tsx` — current memory viewer
- `src/app/api/command-center/memory/route.ts` — memory API
- `~/.openclaw/workspace/memory/` — daily memory files
- `~/.openclaw/workspace/memory/MEMORY.md` — synthesized facts
- AGENTS.md Rule 13: mandatory logging rule (already exists)

---

## TASK 18: Cron Calendar — Real-Time + Editable + Apple/Google Calendar Integration

**File:** `src/app/command-center/calendar/page.tsx` (222 lines)

### Current State
- Hardcoded `CRON_EVENTS` array with 17 events — **NOT reading from the actual cron system**
- Shows weekly schedule grid with events placed by time and day
- No edit capability — read-only
- No integration with external calendars

### Required Changes

#### 18a. Wire to Real Cron Data
- Replace the hardcoded `CRON_EVENTS` array with live data from `~/.openclaw/cron/jobs.json`
- The cron file has the actual jobs with: id, name, schedule (cron expr or "at" time), enabled/disabled, last run status, agent
- New API route: `GET /api/command-center/calendar/crons` that reads `jobs.json` and returns parsed events
- Parse cron expressions to determine which days they fire on
- Show disabled crons in a dimmed/crossed-out style

#### 18b. Edit Crons from Calendar
- Click any event → opens edit modal with:
  - Name (editable)
  - Schedule (cron expression editor or time picker)
  - Enabled toggle
  - Target agent
  - Payload/prompt (what the cron does)
- "Add New Cron" button that creates a new job
- "Delete" button with confirmation
- All changes write back to `jobs.json` via: `POST /api/command-center/calendar/crons`
- After writing to `jobs.json`, reload the OpenClaw cron scheduler: the Gateway must be notified to pick up changes (call `openclaw gateway restart` or use the cron tool's refresh mechanism)

#### 18c. Real-Time Execution Status
- Show which crons fired today and their results (from `~/.openclaw/cron/history.json`)
- Color-code: green = success, red = failed, yellow = running, grey = pending
- Show a "Next fire time" for each cron based on its schedule
- Live update as crons execute throughout the day

#### 18d. Apple Calendar Integration
- Use the `apple-calendar` skill to sync OpenClaw cron events into Apple Calendar
- Skill location: `/Users/admin/.openclaw/workspace/skills/apple-calendar/SKILL.md`
- Two-way sync:
  1. **Export crons → Apple Calendar:** Create calendar events for each cron job so Ramon can see them on his phone
  2. **Import Apple Calendar → CC:** Show Ramon's personal calendar events alongside cron events (read-only)
- New API route: `GET /api/command-center/calendar/apple` using AppleScript (the skill uses this)
- Display Apple Calendar events in a different color/style from cron events

#### 18e. Google Calendar Integration (Optional)
- Use Google Calendar API with a service account
- Same two-way sync pattern as Apple Calendar
- Lower priority — Apple Calendar is the primary since Ramon is on Apple ecosystem

#### 18f. Calendar Enhancements
- **Month view** in addition to the current week view
- **Day view** for detailed hour-by-hour schedule
- **Drag-and-drop** to reschedule crons (updates `jobs.json`)
- **Conflict detection** — warn if two agent crons overlap and might compete for resources
- **History view** — see past cron executions with success/failure timeline

### Context Files
- `src/app/command-center/calendar/page.tsx` — current calendar page
- `~/.openclaw/cron/jobs.json` — actual cron definitions (complex JSON, ~100+ jobs)
- `~/.openclaw/cron/history.json` — execution history
- Skill: `/Users/admin/.openclaw/workspace/skills/apple-calendar/SKILL.md` — Apple Calendar integration
- OpenClaw cron tool documentation: check `/Users/admin/.openclaw/workspace/docs/`

---

## Vercel vs. Tunnel: The Two Versions Explained

### What They Are
The Command Center runs in **two places simultaneously**:

1. **Vercel** (`ramiche-site.vercel.app/command-center`)
   - Hosted on Vercel's edge network
   - Deploys automatically on every `git push` to `main`
   - **Advantage:** Accessible from anywhere (phone, away from home)
   - **Limitation:** API routes run as serverless functions — they CANNOT access the local filesystem, OpenClaw Gateway, or Ollama. They can only access cloud services (Firestore, external APIs)

2. **Tunnel** (`command.parallaxvinc.com/command-center`)
   - Runs on the local iMac via `next dev` or `next start`
   - Exposed to the internet via Cloudflare Tunnel or Tailscale Funnel
   - **Advantage:** Full access to local filesystem (memory files, YOLO builds, git repos), OpenClaw Gateway (agent sessions, crons), Ollama (local models), Bambu Lab printer (MQTT)
   - **Limitation:** Only works when the iMac is running and tunnel is active

### Why They Show Different Data
- **Filesystem reads** (YOLO builds, memory files, cron jobs) work on tunnel but return empty/stale on Vercel because Vercel serverless has no local disk
- **Firestore reads** work identically on both — this is the bridge
- **OpenClaw Gateway calls** only work on tunnel (Gateway is localhost)
- **Hardcoded fallback data** in the code differs between commits when unpushed

### The Architecture Solution (Why Decisions Were Made)
To make both versions work identically:
1. **Firestore is the single source of truth** for all shared state (agents, tasks, projects, metrics)
2. **Bridge sync script** (runs on the local machine) reads local files and pushes to Firestore every 30s
3. **Both Vercel and Tunnel** read from Firestore via the bridge API — same data
4. **Local-only features** (Gateway controls, terminal, real-time scanning) show a "Local access only" badge on Vercel with a link to the tunnel URL
5. **YOLO build metadata** syncs to Firestore; actual `index.html` files deploy as standalone Vercel projects

### What Must Be True for Both to Work in Real-Time
- Bridge sync runs continuously on the local machine (cron or daemon)
- All data writes go through Firestore, not local files directly
- API routes check for local access (`req.headers.host.includes('localhost')`) and degrade gracefully on Vercel
- SSE endpoint (real-time) only works on tunnel — Vercel uses polling fallback

### Reference: How Successful Teams Solve This
- **Linear** (linear.app) — their entire app is a real-time syncing engine. They use CRDTs (conflict-free replicated data types) to keep all clients in sync. Their architecture: local-first writes → sync to server → push to all clients via WebSocket. Reference: https://linear.app/blog/scaling-the-linear-sync-engine
- **Vercel Dashboard** itself — Vercel's own dashboard shows real-time deploy status. They use Server-Sent Events for streaming log output and polling for status checks. Their serverless functions proxy to internal APIs.
- **Retool** (retool.com) — internal tool builder that connects to any data source. Their architecture: frontend queries a backend proxy which connects to databases/APIs. Same pattern as our bridge API.
- **Grafana** — the gold standard for operational dashboards. Real-time via WebSocket/SSE, pluggable data sources, alerting. Our observatory and health pages should aspire to Grafana's data pipeline pattern.

---

## Execution Order (Revised — 18 Tasks, 6 Phases)

### Phase 1: Foundation (Do First)
1. **Task 6a** — Remove hardcoded DEFAULT_AGENTS from settings
2. **Task 2a** — Wire agents page to live data
3. **Task 7b** — Fix YOLO build viewing (batch deploy or Firestore)
4. **Task 9a** — Fix Finance HQ page loading
5. **Task 18a** — Replace hardcoded calendar with real cron data

### Phase 2: Real-Time Wiring
6. **Task 5** — System Health full wiring + ClawGuard
7. **Task 12** — Observatory real data
8. **Task 7a** — YOLO real-time updates via SSE
9. **Task 4** — Cron audit + management UI
10. **Task 16** — Projects page real-time + task granularity

### Phase 3: Agent Control (Core Value)
11. **Task 1** — Chat system full real-time wiring
12. **Task 3** — Task board with real approve/start/reject
13. **Task 7c/7d** — YOLO approve/reject that actually notifies agents
14. **Task 6b** — Settings with Gateway controls
15. **Task 17b** — Enforce agent logging system-wide

### Phase 4: Team Pages + Integration
16. **Task 10** — All team pages wired with real data
17. **Task 13** — Studio ↔ Parallax website integration
18. **Task 9b/9c** — Meridian + Kiyosaki finance build-out
19. **Task 15** — Fabrication full 3D printing pipeline

### Phase 5: Advanced Features
20. **Task 14** — App Builder full EAS/Expo pipeline
21. **Task 18b/c** — Calendar editing + execution status
22. **Task 18d** — Apple Calendar integration
23. **Task 17c/d** — Version numbers, revert points, conversation logs
24. **Task 16c** — Project detail views with git history

### Phase 6: Polish
25. **Task 2c** — Unique avatars for all agents
26. **Task 11** — Design consistency across all pages
27. **Task 8** — Nerve Center v1 restoration
28. **Task 2b** — Agent editing from agents page
29. **Task 17e** — Knowledge base growth visualization
30. **Task 18f** — Calendar enhancements (month view, drag-drop)

---

## Design Rules (HARD — applies to ALL pages)

1. **NO DARK MODE on Parallax products** — but Command Center IS dark themed (black ops aesthetic). This is internal tooling, not customer-facing.
2. **Fill the screen** — no restrictive `max-width` containers that leave white space
3. **Breathing room** — generous padding (24-32px), gap (12-16px)
4. **Border-2 minimum** on interactive elements
5. **Symmetry matters** — grid columns should be even
6. **Heartbeat glows** — active elements should have subtle animated glows
7. **Game-like UI** (Fortnite/Fallout energy) — NOT corporate SaaS
8. **Grid pattern:** `grid-cols-1 md:2 lg:3 xl:4`
9. **ParticleField** component on every page
10. **Linear format** — consistent card-based layout across all pages

---

## Key Principles

- **No fake data.** If there's no real data, show an empty state.
- **Every button must do something.** If it can't, remove it.
- **Real-time means real-time.** SSE or 10s polling minimum. Tunnel uses SSE. Vercel uses polling + Firestore.
- **Agent actions must be actionable.** Approve = agent starts working. Reject = agent gets feedback logged to memory.
- **One source of truth.** `agents/directory.json` for agents. Firestore for shared state. Memory files for logs. `cron/jobs.json` for schedules.
- **Both Vercel and Tunnel must work.** Firestore bridge syncs local state to cloud. Local-only features degrade gracefully on Vercel with clear messaging.
- **Everything logged with timestamps and version numbers.** Git commit hashes on code changes. ISO timestamps on all entries. Revert points accessible from the UI.

---

*Generated by Atlas — Mar 29, 2026. 18 tasks, 6 phases, 30 execution steps.*
