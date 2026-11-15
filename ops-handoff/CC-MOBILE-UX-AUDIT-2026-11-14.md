# CC-MOBILE-UX-RECOVERY-01 — audit and corrections

**Baseline:** production merge `f538fee0aff0f7cb20ce73c692beba87f853b8da`.
**Branch:** `fix/command-center-mobile-ux-01`.
**Status:** draft implementation and evidence only. No merge or deployment.

## Method and limits

The owner's failure screenshot was reviewed first. No new defect screenshots were supplied, so the
authenticated interface was captured in an isolated local production build: PostgreSQL 17,
PostgREST, a local service-role session, and Chromium through Playwright. The local harness never
touched production data, secrets or devices.

Viewports: 320, 375, 390, 393, 430, 768 and 1440 CSS pixels, plus a 844x390 landscape phone.
Routes: all 49 static Command Center routes at 393; nine highest-traffic routes at every width.
The dynamic detail routes (`/leads/[leadId]`, `/projects/[slug]`) were not captured.

This is Chromium evidence, not native iOS. The installed-PWA, keyboard, safe-area and Dynamic Type
checks still require the owner's iPhone.

## Confirmed defects

| Severity | Screen | Evidence | Cause | Correction |
|---|---|---|---|---|
| P0 | Dashboard / any first visit | `before-393-dashboard-briefing.png` | `useBriefing` auto-opened the 96vw briefing sheet after 1.8s on every viewport | Auto-open only at 1024px and wider; on phones the HUD button opens a full-width sheet with a close control |
| P0 | Navigation drawer | before: HUD z70, drawer z40, toggle z50 | The drawer and its top controls sat under the fixed HUD; the toggle was not reliably clickable | Menu button moved inside the HUD; drawer z80, overlay z75; close button inside the drawer; 44px controls |
| P1 | HUD | `before-393-agents.png` | Search bar compressed to 47px, text clipped; 34px controls; no safe-area | Search gets the flexible width; secondary controls hidden on phones; 44px targets; HUD height and content include safe-area insets |
| P0 | Agents | `before-393-agents.png` | Two-column grid with 225px cards; second card reached x467 on a 393px viewport | One column on phones, two on tablets; cards min-width 0 |
| P0 | Finance / Arbitrage | `before-393-finance-arbitrage.png` | Two fixed 1fr columns; output card reached x529 | Stack the parameter and output panels at 1024px and below |
| P0 | Signal Wire | `before-393-signal-wire.png` | 280px roster plus feed at every size; five-column stats; filter strip reached x719 | Phone: feed first, roster below in a 180px scroller, two-column stats, wrapping filters. Tablet: same stack |
| P1 | Tasks / Decisions / Jobs / App Builder | before screenshots | Header actions and status rows exceeded the content box by 5 to 84px | Wrapping headers, task progress chip, job dispatch row and prerequisite rows |
| P1 | Chat | `before-393-chat.png` | Textarea reserved 60px while the @, #, voice and SEND controls occupied about 150px, so the controls overlapped the input; header search collapsed to a blank pill; empty thread had no state | 118px reserved, symbols hidden on touch layouts, search on its own full-width row, empty state, drawer below the HUD, safe-area composer |
| P1 | Alert ticker | code and geometry | 38px fixed ticker over 56px content padding when an alert exists | `:has(#cc-alertbar)` adds 38px to content padding; ticker top includes safe-area |
| P1 | Safe areas | all screenshots | No `viewport-fit=cover`; HUD, drawer, briefing and composer ignored the notch and home indicator | `viewportFit: cover`; top and bottom safe-area insets on HUD, content, drawer, briefing, chat, composer |
| P2 | Dashboard 3D stage | geometry before | Decorative orbit avatars reached x424 on a 393px viewport | Hide orbit nodes/chips on phones; central ATLAS core remains |
| P2 | Health process list | geometry | Long command paths ellipsized with no way to read them | `title` added; intentional truncation remains |
| P2 | Touch targets | geometry before | 17px task buttons, 24px edit buttons, 30 to 38px filter/action buttons | Minimum 44x44 for buttons on phones and tablets; desktop HUD controls remain 34px for mouse density |

## What changed

### Shell

- `src/app/command-center/CommandCenterClientLayout.tsx`: safe-area tokens, HUD and content offsets,
  alert spacing, 44px touch targets, drawer and overlay stacking, mobile page-header wrapping,
  one-column and stacked responsive grids.
- `src/components/command-center/CommandHUD.tsx`: menu control moved into the HUD; secondary
  controls wrapped and hidden on phones; search remains the primary HUD action.
- `src/components/command-center/Sidebar.tsx`: drawer state responds to the HUD event; close button
  added inside the drawer; `100dvh`; safe-area padding.
- `src/components/command-center/BriefingDock.tsx`: mobile sheet class.
- `src/hooks/useBriefing.ts`: auto-open restricted to desktop; phones no longer lose the page to the
  briefing on unlock.
- `src/app/layout.tsx` and `src/app/command-center/layout.tsx`: `viewportFit: "cover"`.

### Screens

- `src/app/command-center/finance/arbitrage/page.tsx`: stack classes for the parameter and output
  panels.
- `src/app/command-center/signal-wire/page.tsx`: stacked main grid, two-column stats, wrapping
  filter row.
- `src/app/command-center/tasks/page.tsx`: wrapping header and progress chip.
- `src/app/command-center/decisions/page.tsx`: two-column stat grid on phones.
- `src/app/command-center/app-builder/page.tsx`: wrapping prerequisite rows.
- `src/app/command-center/jobs/page.tsx`: wrapping dispatch row.
- `src/app/command-center/health/page.tsx`: full command path available on hover/tap.
- `src/app/command-center/chat/page.tsx`: composer spacing, symbol controls hidden on touch,
  full-width search row, empty state, drawer and thread panel below the HUD, safe-area composer.

## Before and after evidence

All images are at 393x852 unless noted.

| Screen | Before | After |
|---|---|---|
| Dashboard | `ops-handoff/cc-mobile-ux/before-393-dashboard-briefing.png` | `ops-handoff/cc-mobile-ux/after-393-dashboard.png` |
| Agents | `.../before-393-agents.png` | `.../after-393-agents.png` |
| Finance / Arbitrage | `.../before-393-finance-arbitrage.png` | `.../after-393-finance-arbitrage.png` |
| Signal Wire | `.../before-393-signal-wire.png` | `.../after-393-signal-wire.png` |
| Tasks | `.../before-393-tasks.png` | `.../after-393-tasks.png` |
| Chat | `.../before-393-chat.png` | `.../after-393-chat.png` |

Interaction and width evidence:

- `after-drawer-open.png`: navigation drawer, safe top, 264px, close control.
- `after-briefing-open.png`: full-width briefing sheet, close control, safe bottom.
- `after-chat-drawer-open.png`: chat drawer below the HUD, 280px, close control.
- `after-width-320-dashboard.png`: 320px HUD and sanctuary layout.
- `after-width-768-agents.png`: tablet two-column agents, icon rail, no clipping.

## Verification

| Check | Result |
|---|---|
| Horizontal document overflow, 320/375/390/393/430/768 | none on the nine key routes |
| Content outside the viewport, same widths | none on the nine key routes |
| Interactive targets under 44x44, same widths | none on the nine key routes |
| 1440 desktop | no overflow or out-of-viewport content; 8 HUD icon controls remain 34px for desktop mouse density |
| Landscape 844x390 | no horizontal overflow |
| Navigation drawer | opens 0 to 264px at z80; close control visible; closes |
| Briefing | mobile auto-open refused; desktop auto-open still works; mobile sheet is 393px wide with close |
| Chat drawer | opens 0 to 280px at z80 below the HUD |
| Authentication | local bootstrap and PIN session; all audited routes returned 200; no auth code changed |
| Tests | 901 passed, 4 skipped |
| TypeScript | clean |
| ESLint | 0 errors, 191 pre-existing warnings |
| Production build | clean |
| Client errors | one pre-existing terminal page client error; no shell or auth errors |

## Remaining real-device acceptance

1. Installed PWA on the owner's iPhone, not Chromium emulation.
2. Safe-area behavior under the notch and home indicator in standalone mode.
3. Keyboard open/close, input visibility and scrolling in chat.
4. Dynamic Type / enlarged text.
5. Real data density, long agent names, logs and error states.
6. Dynamic detail routes (`/leads/[leadId]`, `/projects/[slug]`).
7. Landscape on the phone itself.
8. Offline/error fallback and service-worker cache behavior.
9. Desktop visual regression on a wide monitor (geometry is clean at 1440).

## Native iPhone checklist

1. Launch the installed Command Center PWA. Confirm it opens Command Center, not the marketing site.
2. Confirm the HUD clears the status bar and the bottom composer clears the home indicator.
3. Open and close the navigation drawer; confirm the active item and close control.
4. Confirm the briefing does not open automatically; tap the briefing control and close the sheet.
5. Open Dashboard, Agents, Chat, Tasks, Finance/Arbitrage, Signal Wire, Devices and Settings.
6. In Chat, open the keyboard, type, send, search, and open the channel drawer.
7. In Devices, re-enter the PIN and generate an approval code; confirm all controls are reachable.
8. Rotate to landscape and back; confirm no overlap.
9. Enable a larger text size; confirm labels and primary actions remain readable.
10. Force-close and relaunch; confirm PIN unlock and no repeated enrollment.

## Rollback

Revert this branch or deployment. No authentication, database, secret or deployment configuration
changes are included. The mobile CSS and component changes are isolated to Command Center.
