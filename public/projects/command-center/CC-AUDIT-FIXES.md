# Command Center Audit — Implementation Fix List
*Generated: Mar 27, 2026 by Atlas*
*Target: Drop into Cursor for implementation*

---

## SUMMARY
41 pages audited. 13 API routes checked.
**26 pages fetch live data. 15 pages are 100% static/hardcoded.**

---

## CATEGORY 1: PAGES WITH 100% FAKE/HARDCODED DATA (no API calls)

### 1.1 `/command-center/activity/page.tsx`
**Problem:** 12 hardcoded events from ~Mar 2, all stale. No fetch. No API route.
**Fix:** Create `/api/command-center/activity/route.ts` that reads from OpenClaw workspace memory files (`memory/YYYY-MM-DD.md`) and git log to build real activity feed. Page should fetch on mount + poll every 30s.
**Priority:** HIGH — this is the first thing you see after the main dashboard.

### 1.2 `/command-center/revenue/page.tsx`
**Problem:** `STREAMS` array is hardcoded with 8 revenue items. No real revenue data — amounts are static strings ("$149-549/mo"), statuses never update.
**Fix:** Create `/api/command-center/revenue/route.ts` that pulls from Stripe API (real MRR, transaction history) + manual JSON file for non-Stripe streams. Display real revenue numbers.
**Priority:** HIGH — revenue page showing fake numbers is misleading.

### 1.3 `/command-center/docs/page.tsx`
**Problem:** `DOCUMENTS` array has 22 hardcoded docs from Feb-Mar timeframe. Static titles/dates — never updates when new docs are created.
**Fix:** Create `/api/command-center/docs/route.ts` that scans workspace for actual docs (SKILL.md files, project docs, SOPs). Or maintain a `docs-index.json` that gets updated when docs are added.
**Priority:** MEDIUM — informational page, but stale data reduces trust.

### 1.4 `/command-center/content/page.tsx` (partial)
**Problem:** Content items are hardcoded (3 fake posts: "AI Tips for Coaches", "Weekend Motivation", "Design Process Reveal" from Mar 13-15). Content schedule is accurate but pipeline items are fake.
**Fix:** Wire to `agent-content-pipeline` skill's data store (drafts/reviewed/approved/posted directories) OR create `/api/command-center/content/route.ts` reading from content pipeline files.
**Priority:** HIGH — content pipeline should show real content being created.

### 1.5 `/command-center/yolo/nerve-center/page.tsx`
**Problem:** Comment literally says "Mock data to start - will wire real data later". 5 hardcoded experiments from Mar 13-17. Metrics (88% cost reduction, 5/day velocity) are fake.
**Fix:** Wire to `/api/command-center/yolo-builds` (which already exists and returns real YOLO build data). Pull experiment history from `builds/` directory. Calculate real metrics.
**Priority:** MEDIUM — YOLO nerve center should reflect actual experiment history.

### 1.6 `/command-center/vitals/page.tsx` (partial)
**Problem:** Health vitals (steps, water, sleep, workout) stored in localStorage only — resets on different device/browser. Spiritual data (reading plan, streak) also localStorage-only.
**Fix:** Create `/api/command-center/vitals/route.ts` with simple JSON file persistence so data survives across devices. Weather fetch is real (wttr.in) — that part works.
**Priority:** LOW — personal tracker, localStorage is acceptable for now.

---

## CATEGORY 2: PAGES WITH STALE/OUTDATED HARDCODED CONSTANTS

### 2.1 `/command-center/office/page.tsx`
**Problem:** `FALLBACK_AGENTS` array has wrong models for 10+ agents. Shows "DeepSeek V3.2" for SHURI (now Sonnet 4.5), "GLM 4.6" for MICHAEL (now qwen3:14b), "Haiku 3.5" for WIDOW (now qwen3:14b), "Gemini 3 Pro" for PROXIMON/AETHERION/MERCURY (PROXIMON=Sonnet 4.5, AETHERION=Gemini 3.1 Pro, MERCURY=Sonnet 4.5).
**Fix:** Update FALLBACK_AGENTS to match current models from MEMORY.md agent table. Better: fetch models dynamically from `/api/command-center/agents`.
**Priority:** HIGH — visible to Ramon, shows wrong data.

### 2.2 `/command-center/page.tsx` (main dashboard)
**Problem:** `AGENTS` array (line 15) has stale model names. `MISSIONS`, `OPPS`, `LOG`, `SCHEDULE`, `NOTIFICATIONS` arrays are all hardcoded. Line 304 literally has a TODO: "Live data rendering (replace all hardcoded)".
**Fix:** The main page already fetches some live data (agents, projects, crons) with fallback to hardcoded. But the hardcoded fallbacks are stale. Update all hardcoded constants. Remove stale NOTIFICATIONS. Ensure live data takes priority.
**Priority:** HIGH — this is the landing page.

### 2.3 `/command-center/strategy/page.tsx`
**Problem:** `PRIORITIES` array is hardcoded with 5 business priorities — correct info but never auto-updates. `STRATEGIC_QUESTIONS` are static.
**Fix:** Pull priorities from `/api/command-center/projects` (which exists and returns real project data). Strategy questions can stay static.
**Priority:** LOW — data is mostly accurate, just won't auto-update.

### 2.4 `/command-center/legal/page.tsx`
**Problem:** `IP_PORTFOLIO` (4 items) and `COMPLIANCE_AREAS` (6 items) are hardcoded. Patent status is "Filing" — needs to reflect current status.
**Fix:** Maintain a `legal-status.json` file that gets updated manually when IP status changes. Legal data changes rarely, so a simple JSON file is fine.
**Priority:** LOW — data changes infrequently.

### 2.5 `/command-center/security/page.tsx`
**Problem:** `KNOWN_THREATS` array has 8 hardcoded entries. "API Rate Limiting" still shows `mitigated: false`. Some entries may be outdated.
**Fix:** Review and update `KNOWN_THREATS`. Create a `security-status.json` that WIDOW agent updates when scans run.
**Priority:** MEDIUM — security page should be accurate.

---

## CATEGORY 3: PAGES WITH FAKE/DEMO DATA IN STATE

### 3.1 `/command-center/fabrication/page.tsx`
**Problem:** Print queue (`printQueue`), printers (`printers`), and STL pipeline (`stlPipeline`) are all initialized with fake demo data (fake print jobs like "enclosure-lid-v3.stl" at 47% progress, fake printers A1 Mini and P1S). Data never comes from any real source.
**Fix:** If Bambu Lab printers are connected, wire to bambu-local skill. If not connected yet, show empty states ("No printers connected") instead of fake data.
**Priority:** HIGH — showing fake print jobs is worse than showing empty state.

### 3.2 `/command-center/tasks/page.tsx`
**Problem:** Imports from `pipeline-tasks.json` but also has `INITIAL_TASKS` with hardcoded backlog items (2.1-2.6 task IDs). Tasks are from the original build sprint — most are stale.
**Fix:** Wire exclusively to `/api/command-center/projects` pipeline data. Remove hardcoded INITIAL_TASKS. Pull from PIPELINE.md files in project directories.
**Priority:** HIGH — task board showing old tasks is confusing.

### 3.3 `/command-center/chat/modern/page.tsx`
**Problem:** Line 75: `const typingAgents = ["Shuri", "Vee", "Atlas"].filter(() => Math.random() > 0.7)` — randomly shows agents as "typing" for visual effect. Fake typing indicators.
**Fix:** Remove fake typing simulation. Only show typing when agents are actually responding (wire to real session activity).
**Priority:** MEDIUM — misleading UX.

### 3.4 `/command-center/chat/page.tsx`
**Problem:** `DEFAULT_MESSAGES` (line 160) contains demo chat messages. `DEFAULT_CHANNELS` and `DEFAULT_AGENTS` are hardcoded fallbacks.
**Fix:** The page already fetches from `/api/command-center/chat` — defaults are fallbacks. Ensure the API route returns real data and remove stale defaults.
**Priority:** MEDIUM — chat already partially wired.

---

## CATEGORY 4: BROKEN/MISSING FUNCTIONALITY

### 4.1 NAV BAR — Duplicate "COMMAND" entry
**File:** `/command-center/vitals/page.tsx` line 29-30
**Problem:** NAV array has "COMMAND" listed twice.
**Fix:** Remove the duplicate entry.
**Priority:** LOW — minor UI bug.

### 4.2 Content Pipeline — No persistence
**File:** `/command-center/content/page.tsx`
**Problem:** Created content items exist only in React state — lost on page refresh.
**Fix:** Wire create/update/delete to an API route that persists to JSON files or database.
**Priority:** HIGH — content workflow is useless without persistence.

### 4.3 Terminal — Verify exec endpoint
**File:** `/command-center/terminal/page.tsx`
**Problem:** Sends commands to API but unclear if the exec endpoint actually works in production.
**Fix:** Verify `/api/command-center/terminal` route exists and functions. Add auth check.
**Priority:** MEDIUM — security-sensitive feature.

### 4.4 Settings page — Unverified config mutations
**File:** `/command-center/settings/page.tsx`
**Problem:** Settings page allows model changes, agent config edits — need to verify these actually persist and apply to OpenClaw.
**Fix:** Verify the settings API writes to OpenClaw config and triggers gateway restart.
**Priority:** MEDIUM — settings that don't persist are worse than no settings.

---

## CATEGORY 5: PAGES WORKING CORRECTLY (no changes needed)

These pages fetch real data and function properly:
- `/command-center/agents/page.tsx` — Real agent data from bridge API ✅
- `/command-center/yolo/page.tsx` — Real YOLO builds from API ✅
- `/command-center/memory/page.tsx` — Real memory files from API ✅
- `/command-center/signal-wire/page.tsx` — Real signal data ✅
- `/command-center/observatory/page.tsx` — Real roadmap data ✅
- `/command-center/projects/page.tsx` — Real project data ✅
- `/command-center/health/page.tsx` — Real agent + service checks ✅
- `/command-center/nexus/page.tsx` — Real data ✅
- `/command-center/finance/page.tsx` — Real MERIDIAN data + entity structure ✅
- `/command-center/sales/page.tsx` — Real pipeline from JSON ✅
- `/command-center/calendar/page.tsx` — Real cron schedule ✅
- `/command-center/wellness/page.tsx` — Real agent data ✅
- `/command-center/studio/page.tsx` — Real agent data + accurate artist list ✅

---

## IMPLEMENTATION ORDER (recommended)

**Phase 1 — Quick Wins (update hardcoded constants):**
1. Fix `office/page.tsx` FALLBACK_AGENTS models → match MEMORY.md
2. Fix `page.tsx` main dashboard AGENTS models
3. Fix `vitals/page.tsx` duplicate NAV entry
4. Remove fake typing in `chat/modern/page.tsx`
5. Remove fake print jobs in `fabrication/page.tsx` → show empty state

**Phase 2 — Wire Real Data (create API routes):**
6. Create `/api/command-center/activity/route.ts` → read git log + memory files
7. Wire `yolo/nerve-center` to existing yolo-builds API
8. Wire `content/page.tsx` to content pipeline data (create API route)
9. Wire `tasks/page.tsx` exclusively to pipeline data (remove INITIAL_TASKS)

**Phase 3 — Revenue + Docs (new API routes):**
10. Create `/api/command-center/revenue/route.ts` → Stripe API integration
11. Create `/api/command-center/docs/route.ts` → scan workspace for real docs
12. Create `security-status.json` → WIDOW updates on scan

**Phase 4 — Persistence + Polish:**
13. Add content pipeline persistence (API + JSON storage)
14. Verify terminal and settings page functionality
15. Update `legal/page.tsx` IP status to current
16. Review and update `security/page.tsx` known threats

---

## FILES TO CREATE
- `/api/command-center/activity/route.ts`
- `/api/command-center/revenue/route.ts`
- `/api/command-center/docs/route.ts`
- `/api/command-center/vitals/route.ts`
- `src/data/security-status.json`
- `src/data/legal-status.json`

## FILES TO MODIFY
- `command-center/office/page.tsx` — update FALLBACK_AGENTS
- `command-center/page.tsx` — update hardcoded arrays
- `command-center/vitals/page.tsx` — fix duplicate NAV
- `command-center/chat/modern/page.tsx` — remove fake typing
- `command-center/fabrication/page.tsx` — remove fake print data
- `command-center/yolo/nerve-center/page.tsx` — wire to yolo-builds API
- `command-center/content/page.tsx` — wire to content pipeline
- `command-center/tasks/page.tsx` — wire to pipeline data
- `command-center/security/page.tsx` — update KNOWN_THREATS
- `command-center/legal/page.tsx` — update IP_PORTFOLIO status
- `command-center/docs/page.tsx` — wire to docs API
