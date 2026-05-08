# Command Center — Tunnel vs Vercel Discrepancy Fix

## Implementation Document for Cursor

**Date:** 2026-03-28
**Project:** ramiche-site (`/Users/admin/ramiche-site/`)
**Goal:** Make tunnel (command.parallaxvinc.com) and Vercel (ramiche-site.vercel.app) show identical real-time data. Eliminate all hardcoded fallbacks.

---

## Current Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Tunnel (local)  │     │   Vercel (cloud)  │
│  localhost:3000   │     │   vercel.app      │
└────────┬─────────┘     └────────┬──────────┘
         │                         │
         ├── /api/bridge ──────────┤──→ Firestore (SAME for both ✅)
         │                         │
         ├── /api/command-center/  │
         │   yolo-builds           │
         │   ↓                     │   ↓
         │   Reads from:           │   Reads from:
         │   ~/.openclaw/workspace │   public/builds/
         │   /builds/         │   (committed to git)
         │   128 folders ❌        │   79 folders ❌
         │                         │
         └── page.tsx ─────────────┘
             Has HARDCODED arrays:
             - AGENTS (lines 15-280)
             - Used as fallback when bridge hasn't loaded
```

## Root Causes (3 issues)

### Issue 1: YOLO Builds API reads local filesystem
**File:** `src/app/api/command-center/builds/route.ts`
**Problem:** Uses `readdirSync` on the filesystem. On Vercel, filesystem = build artifacts only (`public/builds/`). On tunnel, filesystem = live workspace (`~/.openclaw/workspace/builds/`). Vercel has 79 builds; workspace has 128.
**Impact:** YOLO page shows 116 builds on tunnel, 55 on Vercel.

### Issue 2: Hardcoded AGENTS array in page.tsx
**File:** `src/app/command-center/page.tsx` (lines 15-280)
**Problem:** 280 lines of hardcoded agent data used as fallback while bridge loads (line 894: `const agents = liveAgents || (bridgeLoaded ? [] : AGENTS)`). Plus a second fetch from `/status.json` (line 875) that merges with hardcoded data. The hardcoded data is stale (wrong statuses, wrong tasks, wrong credit usage).
**Impact:** For ~1-2 seconds on load, users see stale hardcoded data before bridge overwrites it. If bridge fails, they see permanently stale data.

### Issue 3: public/yolo-builds not synced
**Problem:** Only 79 of 128 YOLO build folders are committed to `public/builds/`. New builds are created in the workspace but never copied to the public dir or committed.
**Impact:** Vercel always shows fewer builds than tunnel.

---

## Fix Plan

### Fix 1: Move YOLO builds data to Firestore (proper fix)

**What to change:**
1. Create a sync script that reads `~/.openclaw/workspace/builds/` and pushes build metadata to Firestore (same pattern as the bridge sync for agents/projects).
2. Update `src/app/api/command-center/builds/route.ts` to read from Firestore instead of filesystem.
3. Both tunnel and Vercel will then read from the same Firestore source.

**Alternative (simpler, good enough):**
1. Keep the filesystem read but add a Firestore fallback for Vercel.
2. The existing bridge sync script already runs on the local machine. Extend it to sync YOLO build metadata to Firestore.
3. On Vercel, the API route reads from Firestore. On tunnel, it reads from filesystem (always fresher).

**Files to modify:**
- `src/app/api/command-center/builds/route.ts` — add Firestore read fallback
- Create/extend sync script to push YOLO metadata to Firestore

### Fix 2: Remove hardcoded AGENTS fallback

**What to change:**
1. Delete the `const AGENTS = [...]` array (lines 15-280 in `page.tsx`).
2. Initialize `liveAgents` state as empty array `[]`.
3. Show a loading skeleton until bridge data arrives.
4. Remove the `/status.json` fetch (line 874-891) — it's redundant with bridge data.
5. Change line 894 from `const agents = liveAgents || (bridgeLoaded ? [] : AGENTS)` to `const agents = liveAgents || []`.

**Files to modify:**
- `src/app/command-center/page.tsx` — remove hardcoded AGENTS, add loading state

### Fix 3: Remove public/yolo-builds dependency

**What to change:**
1. Once Fix 1 is done, remove `public/builds/` from git (it's ~79 folders of HTML files bloating the repo).
2. Or alternatively, set up a GitHub Action or pre-push hook that syncs workspace builds to public/.

**Files to modify:**
- `.gitignore` — add `public/builds/` (once Firestore is the source)
- Remove the `BUILDS_DIR_PUBLIC` fallback from the route

---

## Detailed File Changes

### File 1: `src/app/command-center/page.tsx`

**DELETE lines 15-280** (the entire `const AGENTS = [...]` array)

**CHANGE line 289:**
```tsx
// FROM:
const [liveAgents, setLiveAgents] = useState<typeof AGENTS | null>(null);
// TO:
const [liveAgents, setLiveAgents] = useState<any[] | null>(null);
```

**DELETE lines 874-891** (the `/status.json` useEffect — redundant with bridge)

**CHANGE line 894:**
```tsx
// FROM:
const agents = liveAgents || (bridgeLoaded ? [] : AGENTS);
// TO:
const agents = liveAgents || [];
```

**ADD loading state** in the JSX where agents are rendered — if `!bridgeLoaded`, show a pulse/skeleton.

**FIX all references to `typeof AGENTS[number]`** — replace with an explicit interface:
```tsx
interface Agent {
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
  key?: string;
  skills?: string[];
}
```

**FIX the neural network visualization** (lines 741-793) — it references `AGENTS.length` and `AGENTS[i]`. Change to use the resolved `agents` array, with a guard for empty state.

### File 2: `src/app/api/command-center/builds/route.ts`

**ADD Firestore fallback:**
```typescript
import { NextResponse } from "next/server";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const WS = process.env.OPENCLAW_WORKSPACE ?? "/Users/admin/.openclaw/workspace";
const BUILDS_DIR = join(WS, "yolo-builds");

// Firestore config for Vercel fallback
const FIREBASE_PROJECT = "apex-athlete-73755";
const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function fetchFromFirestore(): Promise<any[]> {
  if (!FIREBASE_API_KEY) return [];
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/command-center/yolo-builds`;
  try {
    const res = await fetch(url, { headers: { "x-goog-api-key": FIREBASE_API_KEY } });
    if (!res.ok) return [];
    const doc = await res.json();
    // Extract the builds array from the Firestore document
    return JSON.parse(doc.fields?.builds?.stringValue || "[]");
  } catch { return []; }
}

export async function GET() {
  // Try filesystem first (tunnel/local)
  if (existsSync(BUILDS_DIR)) {
    // ... existing filesystem logic ...
  }

  // Fallback to Firestore (Vercel)
  const builds = await fetchFromFirestore();
  return NextResponse.json(builds);
}
```

### File 3: New sync script addition

**Extend the existing bridge sync** (wherever it lives — likely a cron job or workspace script) to also push YOLO build metadata to Firestore:

```
Firestore path: command-center/yolo-builds
Data: { builds: JSON.stringify(buildMetadataArray) }
```

This ensures the data is always available in Firestore for Vercel reads.

---

## Which Command Center to Use

| Feature | Tunnel (command.parallaxvinc.com) | Vercel (ramiche-site.vercel.app/command-center) |
|---------|-----------------------------------|------------------------------------------------|
| Bridge data (agents, projects, etc.) | ✅ Real-time (Firestore) | ✅ Real-time (Firestore) |
| YOLO builds | ✅ Live filesystem (128 builds) | ❌ Stale public/ dir (79 builds) |
| API routes with fs access | ✅ Full access | ❌ Build-time only |
| Availability | Only when iMac is on + tunnel running | Always up |
| Speed | LAN-fast if local, cloudflare if remote | CDN-fast globally |
| After this fix | ✅ Everything real-time | ✅ Everything real-time via Firestore |

**After implementing these fixes, both will be identical.** The tunnel will be slightly faster for filesystem operations, but functionally equivalent.

---

## Execution Order

1. **Remove hardcoded AGENTS from page.tsx** → commit + push → immediate improvement
2. **Add Firestore fallback to yolo-builds API** → commit + push → YOLO page works on Vercel
3. **Extend bridge sync to push YOLO metadata** → ensures Firestore stays fresh
4. **Clean up public/yolo-builds** → reduce repo bloat (optional, after step 2-3 verified)

Each step is independently deployable. Do them in order, one commit each.

---

## Key Files Reference

| File | Path | Purpose |
|------|------|---------|
| CC Main Page | `src/app/command-center/page.tsx` | 1948 lines, main dashboard |
| YOLO Page | `src/app/command-center/yolo/page.tsx` | 557 lines, YOLO gallery |
| YOLO API | `src/app/api/command-center/builds/route.ts` | 123 lines, reads filesystem |
| Bridge API | `src/app/api/bridge/route.ts` | Firestore proxy |
| Shared Projects | `src/app/command-center/shared-projects.ts` | Hardcoded project data |
| Bridge Sync | (workspace cron job) | Pushes data to Firestore |
| Firebase Config | `src/lib/firebase.ts` | Client-side Firestore init |

---

*Generated by Atlas — Mar 28, 2026*
