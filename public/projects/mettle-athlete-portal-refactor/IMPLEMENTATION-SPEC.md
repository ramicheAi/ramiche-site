# METTLE — Athlete Portal Navigation Refactor

## Problem Statement

The coach's athlete portal has broken navigation:
1. **Monolithic AthletePortal.tsx** (2,977 lines) renders everything via conditional `navSegment` checks
2. **Athlete selection is state-based, not URL-based** — `selectedAthlete` lives in React state and gets lost on any navigation
3. **Only 2 of 13 session routes respect `selectedAthlete`** (CoachCheckInRoute.tsx and CoachParentRoute.tsx) — clicking any other nav item drops the athlete view
4. **Group switching clears athlete selection** explicitly
5. **No deep-linking** — can't bookmark or share a specific athlete's view

## Target Architecture

Add URL-based athlete detail routing under the coach portal:
```
/coach/athlete/[id]                → Athlete overview (dashboard)
/coach/athlete/[id]/progress       → Progress tracking
/coach/athlete/[id]/workouts       → Workouts
/coach/athlete/[id]/times          → Best times / time standards
/coach/athlete/[id]/profile        → Profile details
```

Athlete context persists in the URL. Navigating between tabs keeps the athlete selected. Back button returns to whatever coach view you came from.

---

## Current Architecture (Reference)

### File Structure
```
src/app/coach/
├── (session)/
│   ├── layout.tsx                          → CoachSessionShellClient wrapper
│   ├── checkin/page.tsx                    → CoachCheckInRoute
│   ├── roster/page.tsx                     → CoachCheckInRoute (same)
│   ├── meets/page.tsx                      → CoachMeetsRoute
│   ├── schedule/page.tsx                   → CoachScheduleRoute
│   ├── analytics/page.tsx                  → CoachAnalyticsRoute
│   ├── comms/page.tsx                      → CoachCommsRoute
│   ├── splits/page.tsx                     → CoachSplitsRoute
│   ├── swim-analytics/page.tsx             → CoachSwimAnalyticsRoute
│   ├── standards/page.tsx                  → CoachStandardsRoute
│   ├── parent/page.tsx                     → CoachParentRoute
│   ├── staff/page.tsx                      → CoachStaffRoute
│   ├── audit/page.tsx                      → CoachAuditRoute
│   ├── billing/page.tsx                    → CoachBillingRoute
│   └── white-label/page.tsx                → CoachWhiteLabelRoute
├── CoachSessionDashboard.tsx               → Main orchestrator (builds shellApi)
├── context/
│   ├── CoachContext.tsx                    → State provider
│   ├── CoachAuthContext.tsx                → Auth provider
│   └── CoachSessionShellContext.tsx        → Shell API context
├── sessionRoutes/
│   ├── CoachCheckInRoute.tsx               → Check-in + roster view
│   ├── CoachAnalyticsRoute.tsx
│   ├── CoachMeetsRoute.tsx
│   └── ... (13 total)
├── components/
│   └── CoachAthleteDetailView.tsx          → Current athlete detail (single page)
├── lib/
│   └── coachSessionShell.types.ts          → CoachSessionShellApi interface
└── views/
    └── CheckInView.tsx                     → Check-in UI
```

### How Selection Works Today
- `selectedAthlete: string | null` is state in CoachContext
- `CoachSessionDashboard.tsx` builds a `shellApi` object with `selectedAthlete` + `setSelectedAthlete`
- Only `CoachCheckInRoute.tsx` and `CoachParentRoute.tsx` check `s.selectedAthlete` and render `AthleteDetailView` if set
- All other routes ignore `selectedAthlete` — navigating to them silently loses the context
- `switchGroup()` explicitly sets `setSelectedAthlete(null)`

### CoachSessionShellApi (key fields)
```typescript
interface CoachSessionShellApi {
  selectedAthlete: string | null;
  setSelectedAthlete: Dispatch<SetStateAction<string | null>>;
  AthleteDetailView: ComponentType<{ athlete: Athlete; onBack: () => void }>;
  roster: Athlete[];
  filteredRoster: Athlete[];
  selectedGroup: GroupId;
  // ... 100+ other fields
}
```

---

## Implementation Plan

### Phase 1: Add URL-Based Athlete Detail Route

#### Step 1.1: Create route structure

Create the following files:

```
src/app/coach/(session)/athlete/[id]/
├── layout.tsx                → Athlete detail layout with sub-nav tabs
├── page.tsx                  → Default view (overview/dashboard)
├── progress/page.tsx         → Progress tab
├── workouts/page.tsx         → Workouts tab
├── times/page.tsx            → Best times tab
└── profile/page.tsx          → Profile tab
```

#### Step 1.2: Create athlete detail layout

**File: `src/app/coach/(session)/athlete/[id]/layout.tsx`**

This layout:
1. Reads the `[id]` param from the URL
2. Uses `CoachSessionShellContext` to find the athlete in `roster`
3. Renders a tab bar (Overview | Progress | Workouts | Times | Profile)
4. Passes `children` below the tab bar
5. Shows a back button that navigates to the previous coach route (use `router.back()` or a stored referrer)

```tsx
"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useCoachSessionShell } from "../../../context/CoachSessionShellContext";
import BgOrbs from "../../../components/BgOrbs";

const TABS = [
  { label: "Overview", href: "" },
  { label: "Progress", href: "/progress" },
  { label: "Workouts", href: "/workouts" },
  { label: "Times", href: "/times" },
  { label: "Profile", href: "/profile" },
];

export default function AthleteDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const s = useCoachSessionShell();

  const athlete = s.roster.find((a) => a.id === params.id);

  if (!athlete) {
    router.replace("/coach/roster");
    return null;
  }

  const basePath = `/coach/athlete/${params.id}`;
  const activeTab = pathname.replace(basePath, "") || "";

  return (
    <div className="min-h-dvh bg-[#0e0e18] text-[#f8fafc] relative overflow-x-hidden">
      <BgOrbs />
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-10 pb-24 md:pb-10">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#A78BFA]/60 hover:text-[#A78BFA] transition-colors mt-6 mb-4 group min-h-[46px]"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="transition-transform group-hover:-translate-x-1">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-bold font-mono tracking-wider uppercase">Back</span>
        </button>

        {/* Athlete header (name, level, avatar) */}
        {/* Reuse the top section from CoachAthleteDetailView */}

        {/* Tab navigation */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 mb-6">
          {TABS.map((tab) => {
            const href = `${basePath}${tab.href}`;
            const isActive = activeTab === tab.href;
            return (
              <Link
                key={tab.href}
                href={href}
                className={`px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors ${
                  isActive
                    ? "text-[#A78BFA] border-b-2 border-[#A78BFA]"
                    : "text-[#f8fafc]/50 hover:text-[#f8fafc]/80"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Tab content */}
        {children}
      </div>
    </div>
  );
}
```

#### Step 1.3: Create tab pages

Each tab page reads `params.id`, finds the athlete in the shell context, and renders the relevant content.

**File: `src/app/coach/(session)/athlete/[id]/page.tsx`** (Overview)
```tsx
"use client";

import { useParams } from "next/navigation";
import { useCoachSessionShell } from "../../../context/CoachSessionShellContext";

export default function AthleteOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const s = useCoachSessionShell();
  const athlete = s.roster.find((a) => a.id === id);
  if (!athlete) return null;

  // Render the main athlete detail content
  // Extract from CoachAthleteDetailView — XP card, streaks, checkpoints, daily cap
  return (
    <div>
      {/* Port the relevant sections from CoachAthleteDetailView */}
    </div>
  );
}
```

**Progress, Workouts, Times, Profile** follow the same pattern — each renders the relevant section that currently lives inside the monolithic AthletePortal.tsx or CoachAthleteDetailView.tsx.

#### Step 1.4: Update athlete selection to use navigation

In `CoachCheckInRoute.tsx` (and anywhere else athletes are clickable), change:
```tsx
// BEFORE:
onClick={() => s.setSelectedAthlete(athlete.id)}

// AFTER:
onClick={() => router.push(`/coach/athlete/${athlete.id}`)}
```

Remove the `selectedAthlete` conditional render from `CoachCheckInRoute.tsx`:
```tsx
// REMOVE this block (lines 22-28):
if (s.selectedAthlete) {
  const detailAthlete = s.roster.find((a) => a.id === s.selectedAthlete);
  if (detailAthlete) {
    return <AthleteDetailView athlete={detailAthlete} onBack={() => s.setSelectedAthlete(null)} />;
  }
  s.setSelectedAthlete(null);
}
```

Do the same for `CoachParentRoute.tsx`.

#### Step 1.5: Update navigation config

Add breadcrumb support in `coachNavConfig.tsx`:
```tsx
// Add to coachBreadcrumbsFromPathname:
if (parts[1] === "athlete" && parts[2]) {
  const athleteId = parts[2];
  const tabLabel = parts[3] ? parts[3].charAt(0).toUpperCase() + parts[3].slice(1) : "Overview";
  return [
    { label: "Portal", href: "/portal" },
    { label: "Coach", href: "/coach/checkin" },
    { label: "Athlete", href: `/coach/athlete/${athleteId}` },
    { label: tabLabel, href: undefined },
  ];
}
```

### Phase 2: Refactor AthletePortal.tsx (Athlete-Facing)

The 2,977-line `AthletePortal.tsx` is the **athlete's own portal** (not the coach viewing an athlete). Refactor it to use the existing route structure:

```
src/app/athlete/
├── dashboard/page.tsx      → Already exists
├── workouts/page.tsx       → Already exists
├── progress/page.tsx       → Already exists
├── profile/page.tsx        → Already exists
└── AthletePortal.tsx       → Currently renders ALL of the above via navSegment
```

**Fix:** Each `page.tsx` already exists but likely just renders `<AthletePortal />`. Change them to render only their section:

1. Extract each navSegment block from AthletePortal.tsx into standalone components:
   - `AthletePortal.tsx` lines 1536-1710 → `components/athlete/DashboardSection.tsx`
   - `AthletePortal.tsx` lines 1711-2353 → `components/athlete/ProgressSection.tsx`
   - `AthletePortal.tsx` lines 2354-2448 → `components/athlete/WorkoutsSection.tsx`
   - `AthletePortal.tsx` lines 2449-2916 → `components/athlete/ProfileSection.tsx`

2. Create a shared layout at `src/app/athlete/layout.tsx` that provides the common state (currently all the useState calls in AthletePortal.tsx lines 1-600)

3. Move shared state into an `AthleteContext` provider in the layout

4. Each page.tsx renders only its extracted section component

### Phase 3: Polish

1. **Sync `selectedAthlete` state with URL** — when navigating to `/coach/athlete/[id]`, set `selectedAthlete` in context so that components that need it (like the header) still work
2. **Remove `switchGroup` clearing athlete selection** — no longer needed since athlete context is URL-based
3. **Add loading states** for route transitions
4. **Mobile: bottom sheet pattern** — on mobile, athlete detail could slide up as a sheet instead of full page navigation (optional enhancement)

---

## Key Files to Modify

| File | Change |
|------|--------|
| `src/app/coach/(session)/athlete/[id]/layout.tsx` | **CREATE** — New athlete detail layout with tabs |
| `src/app/coach/(session)/athlete/[id]/page.tsx` | **CREATE** — Overview tab |
| `src/app/coach/(session)/athlete/[id]/progress/page.tsx` | **CREATE** — Progress tab |
| `src/app/coach/(session)/athlete/[id]/workouts/page.tsx` | **CREATE** — Workouts tab |
| `src/app/coach/(session)/athlete/[id]/times/page.tsx` | **CREATE** — Times tab |
| `src/app/coach/(session)/athlete/[id]/profile/page.tsx` | **CREATE** — Profile tab |
| `src/app/coach/sessionRoutes/CoachCheckInRoute.tsx` | **MODIFY** — Remove selectedAthlete conditional, use router.push |
| `src/app/coach/sessionRoutes/CoachParentRoute.tsx` | **MODIFY** — Same as above |
| `src/app/coach/components/CoachAthleteDetailView.tsx` | **MODIFY** — Extract into reusable sections for tab pages |
| `src/components/coach/coachNavConfig.tsx` | **MODIFY** — Add athlete breadcrumb support |
| `src/app/coach/CoachSessionDashboard.tsx` | **MODIFY** — Sync selectedAthlete with URL param |
| `src/app/athlete/AthletePortal.tsx` | **MODIFY** (Phase 2) — Extract sections into standalone components |

---

## Constraints

- **Do NOT break existing coach session routes** — this is additive
- **Keep the `CoachSessionShellApi` context** — athlete detail pages consume it via `useCoachSessionShell()`
- **Preserve the game HUD header** — use `GameHUDHeaderShell` from shell context
- **Dark theme** — all new pages follow existing `bg-[#0e0e18] text-[#f8fafc]` pattern
- **Mobile-first** — tabs must be scrollable horizontally on mobile
- **No new dependencies** — use existing Next.js routing, no external router libs

---

## Implementation Order

1. Create route files (Step 1.1)
2. Create layout with tabs (Step 1.2)
3. Port CoachAthleteDetailView content into Overview page (Step 1.3)
4. Create stub pages for Progress/Workouts/Times/Profile (Step 1.3)
5. Update click handlers to use `router.push` (Step 1.4)
6. Remove old `selectedAthlete` conditional renders (Step 1.4)
7. Update breadcrumbs (Step 1.5)
8. Test: click athlete → see tabbed view → navigate tabs → back button works
9. Phase 2: Extract AthletePortal.tsx sections (separate PR)

---

## Done Criteria

- [ ] Clicking an athlete name anywhere in coach portal navigates to `/coach/athlete/[id]`
- [ ] Athlete detail has tabbed navigation (Overview, Progress, Workouts, Times, Profile)
- [ ] Navigating between tabs preserves athlete context (URL-based)
- [ ] Back button returns to previous coach view (not the roster list specifically)
- [ ] Deep-linking works: pasting `/coach/athlete/abc123/progress` loads the correct view
- [ ] No console errors, build passes
- [ ] Mobile: tabs scroll horizontally, back button accessible
- [ ] Existing coach routes (checkin, meets, schedule, etc.) still work unchanged
