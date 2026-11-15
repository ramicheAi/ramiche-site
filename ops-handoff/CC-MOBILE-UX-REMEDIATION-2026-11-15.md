# CC-MOBILE-UX-RECOVERY-01 — remediation of the independent review

**Reviewed head:** `2f8b9516`. **This work:** continued on the same branch on top of the author's own
follow-ups (`ab5b86fd`, `1ada10c2`). **Production:** frozen at `f538fee0` throughout. Nothing merged,
nothing deployed.

## What the review found, and what is done about it

| # | Finding | Fix | Evidence |
|---|---|---|---|
| 1 | `viewportFit: "cover"` was added to the **root** layout, so every marketing route ran under the notch with no safe-area handling anywhere outside Command Center | Reverted on the root; the Command Center keeps its own scoped contract | `shell-invariants`: root has no `viewportFit`, CC does, and a grep proves no `safe-area-inset` exists outside `command-center/`. Rendered `/` carries `width=device-width, initial-scale=1, maximum-scale=5` and **no** `viewport-fit`. `marketing-home-{390,1440}.png` |
| 2 | Chat composer pushed ~38px below the fold whenever the alert ticker was mounted: the pane sized itself from `100dvh - 56px` while its container gained the ticker's 38px | Pane gives back the ticker at both breakpoints (94px phone, 102px tablet), and the desktop pane now accounts for the 64px HUD it previously ignored (an 8px overflow that predates this PR) | Harness measures the composer bottom at 320/375/390/430/768/1024/1440, **with and without** the ticker; all sit at or inside the viewport |
| 3 | Pulse and wake-word unreachable at ≤1024 with no alternative; theme had no in-PWA path | The drawer now carries functional **Pulse, Wake word and Theme** controls (real handlers, `aria-pressed`, state passed from the shell), plus the author's Appearance control in Settings | `Sidebar.mobile.test`: each control fires its intent and reflects pressed state. Harness: the row renders at every phone width and is hidden on desktop |
| 4 | Overlay (z75) sat above the HUD (z70), and the drawer (z80) covered the menu button, so the menu opened the drawer and could never close it | Stacking is now content < overlay 65 < HUD 70 < briefing 80 < drawer 85, and the drawer starts **below** the HUD (`top: 56px + safe-area`) so the menu stays a live toggle | Harness hit-tests the menu's own centre **with the drawer open** at 5 phone widths: the menu button is the topmost element every time. HUD reports `aria-expanded` and swaps its label |
| 5 | Closed drawer stayed in the tab order; no Escape; no focus restoration | `inert` + `aria-hidden` on the closed drawer (phone widths only, never on the desktop rail), Escape closes it, focus moves to the close control on open and returns to whatever opened it on close | `Sidebar.mobile.test`: inert when closed, interactive when open, Escape closes and returns focus to the menu button, never inert above 768px |
| 6 | Blanket `button { min-height: 44px }` inflated the 26px rail dividers and turned dense 7-button chat rows into clipped squares | Replaced with targeted selectors (icon buttons, nav rows, quick controls, filter rows, header actions). Rail dividers and inline clusters are excluded deliberately | Harness: rail divider 17–24px (not 44) at 768/1024/1440; chat action buttons 33px wide, not 44; menu and quick controls still ≥44 |

## Evidence

* `npx vitest run` — **923 passed, 4 skipped** (was 901/4; the 22 new tests are the two files below).
* `npm run lint` — 0 errors, 192 warnings (191 pre-existing + 0 from this work; the harness's unused
  import was removed).
* `npx tsc --noEmit` — clean. `npm run build` — clean.
* `node scripts/cc-shell-harness.mjs --shots` — **102 checks, 0 failed**, at 320/375/390/430/768/1024/1440.
* Screenshots: `ops-handoff/cc-mobile-ux-remediation/` (`shell-*`, `drawer-open-*`,
  `marketing-home-*`).

## Tests added

* `src/components/command-center/__tests__/shell-invariants.test.ts` — the six requirements, asserted
  against the source: viewport-fit scope, safe-area containment, chat height with and without the
  ticker, no blanket button rule, stacking order, drawer top offset, toggle labelling, `inert`,
  Escape, focus restoration, and the presence of the three quick controls.
* `src/components/command-center/__tests__/Sidebar.mobile.test.tsx` — the drawer's behaviour in jsdom:
  inert when closed, interactive when open, Escape + focus restoration, never inert on desktop, and
  each quick control firing its intent.

## What this evidence is and is not

The shell harness mounts the **real stylesheets** (all thirteen `po-*.css` files, the shell's own
CSS-in-JS blocks, and the chat page's), over the shell's real element structure, in Chromium. It
measures stacking, hit targets, inset arithmetic and clipping — the things jsdom cannot see.

It is **not** the authenticated application. `/command-center` sits behind the owner guard (Firebase
session, or a trusted-device PIN cookie re-checked against a live database row), and this pass did not
weaken or bypass it: against the local build, `/command-center` and `/command-center/chat` still
return the guard's deny-by-default 503. Data-bearing panels are therefore absent from the harness, and
real-data density, the installed PWA, safe areas under a real notch, the real keyboard and Dynamic
Type still require the owner's iPhone — unchanged from the author's original acceptance list.

## Still open (not blocking, not fixed here)

* `/leads/[leadId]` still uses a fixed `1fr 1fr` grid and `/projects/[slug]` a `240px 1fr` when a doc
  is open; both were outside this PR's capture and remain unverified on a phone.
* The Signal Wire network canvas is hidden at ≤1024 rather than shrunk, and its roster/feed separator
  sits on the wrong edge in `column-reverse`. Cosmetic; disclosed.
