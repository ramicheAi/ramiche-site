# Parallax OS — porting contract (read before building any screen)

You are recreating the HTML/CSS/JSX prototype in `prototype/` as **real React 19 +
TypeScript** components inside the `ramiche-site` Next.js 16 app. This is a **reskin —
never change existing logic/APIs**. The build must stay green (`npx tsc --noEmit` and
`npm run build`). Lift exact values (hex, spacing, type, motion) from the prototype.

## Where things go
- **Screen components** → `src/components/command-center/po/<Name>.tsx` (`'use client'`).
- **CSS** is ALREADY ported (scoped to `.po-shell`) at `src/app/command-center/po/*.css`
  and imported globally for the cockpit. Just use the prototype class names — they
  already resolve. Do NOT re-add `<style>` blocks for things the CSS already covers.
- **Route wiring**: each `src/app/command-center/<route>/page.tsx` renders its screen
  component. For existing pages with real logic, prefer restyling in place; if replacing
  the presentation, keep every existing data source / API call.

## Everything renders INSIDE `.po-shell`
The cockpit layout wraps all routes in `<div class="po-shell" data-po-theme=…>` (see
`PoShell.tsx`). So all ported CSS classes and `var(--accent)`, `var(--ink-1)`, etc.
already work. You never add the wrapper yourself.

## Shared modules (import these — do not duplicate)
- `@/lib/cc-theme` — `ACCENTS`, `SECTION_ACCENT`, `accentFor(id)`, `HOLO`, `HOLO_CONIC`, `type Theme`.
- `@/lib/po-data` — `NAV`, `ROUTE` (nav id → real href), `PAGE`, `AGENTS`, `agentById(id)`,
  `CHANNELS`, `DMS`, `VITALS`, `FEED`, `LEADS`, `A` (accent css-var map), and the types.
- `@/components/command-center/po/Brand` — `<Logo size/>`, `<Icon name size stroke/>`, `Sigil`.
  Icon names: see the `I` map (dashboard, comms, agents, finance, atlas, sun, clock, command,
  search, send, mic, attach, hash, dispatch, spark, check, pulse, gateway, chevron, chevdown…).
- `@/components/command-center/po/Avatar` — `<Avatar agent={Agent} size bob pip/>` (character face).
- `@/components/command-center/po/PoShell` re-exports `usePoTheme()` →
  `{ theme, setTheme, toggleTheme, accent, still, setStill }`. (import from
  `@/components/command-center/PoShell`).
- `@/lib/po-sound` — `poPlay('nav'|'blip'|'open'|'dispatch'|'success'|'alert'|'boot')`,
  `initPoSound()`, `isPoSoundEnabled()`, `setPoSoundEnabled(b)`.
- `@/lib/po-alert-bus` — `poAlertBus.set(key,{label,value,page,pageLabel,serial})`,
  `poAlertBus.clear(key)`, `usePoAlerts()` (live list).

## Character assets
Served from `/assets/characters/1.png … 11.png` (#11 = a planet/world for Observatory).
Use `<Avatar agent={…}>` for agent faces; use `/assets/characters/N.png` directly for
gallery/observatory plates. Logo mask is at `/assets/po-logo-mask.png` (the `.po-logomark`
CSS already points there).

## ⚠️ The alert/toast gotcha (carried from the prototype)
Side effects that update a PARENT (toasts, the alert bus) must fire from a post-render
`useEffect` keyed on the data — NEVER inside a `setState` updater, or React throws
"Cannot update a component while rendering a different component." Use a pure updater for
live values + a separate reconcile effect with a `prevCrit` ref for edge detection.

## Live drift
Instrument values, gauges, Finance MRR, Observatory signals update on intervals
(1.5–2.6s) via `setInterval` in `useEffect` (cleared on unmount). Keep drift as a
presentation layer; where a real data source exists, back the number with it.

## Motion / a11y
Gate ambient motion on `prefers-reduced-motion` (CSS already does) AND the `.po-still`
class (the "Breathing motion" tweak — `usePoTheme().still`).

## TypeScript
Strict. Type props. For CSS custom props in `style`, cast:
`style={{ ['--accent' as string]: hex } as React.CSSProperties}`. Avoid `any`. Avoid
`<img>` lint errors by adding `{/* eslint-disable-next-line @next/next/no-img-element */}`
or using next/image where simple.

---

# RESTYLE MODE — give an existing route the cockpit look WITHOUT losing function

Use this when restyling an already-built, functional Command Center route (NOT building
a showpiece from the prototype). The page keeps ALL its behavior; only presentation changes.

## Absolute rules
- **Preserve every function.** Do NOT remove, rename, or reorder any state, hook, effect,
  data fetch, event handler, prop, or control-flow. Do NOT change any `/api` call, route,
  or data binding. If you're unsure whether something is logic or style — it's logic; leave it.
- Only change the **presentation layer**: colors, surfaces, borders, fonts, spacing, and
  wrapping containers. The set of interactive elements and what they do must be identical.
- Keep `npx tsc --noEmit` and eslint clean for every file you touch. Don't run `npm build`.

## How to restyle a page
1. Wrap the page's rendered root in the instrument chrome from
   `@/components/command-center/po/Instrument`:
   ```tsx
   import { InstrumentPage, Panel, PgBtn } from '@/components/command-center/po/Instrument';
   // …
   return (
     <InstrumentPage id="<routeId>" title="<Page Title>" section="<Sidebar Section>"
       icon="<iconName>" accent="var(--c-<accent>)" actions={<PgBtn icon="reports">Export</PgBtn>}>
       {/* the page's EXISTING content, with tokens migrated and blocks wrapped in <Panel> */}
     </InstrumentPage>
   );
   ```
   - `routeId`/`accent`/`section`/`icon` come from `SECTION_ACCENT` in `@/lib/cc-theme` and the
     existing Sidebar `sections` array. Icon names: see `Brand.tsx` `I` map.
   - If the page already has a big bespoke header, replace just that header with `<InstHeader/>`
     (or `InstrumentPage`) and keep the body.
2. **Token migration** (swap hardcoded values → CSS vars; these resolve inside `.po-shell`):
   - bg `#0a0a0a`/`#050505`/`#0e0e18`/`#111`/`#1a1a2e` → `var(--ink-1)` (panels) / `var(--ink-2)` (raised) / `transparent`
   - purple `#7c3aed`/`#a855f7`/`#8b5cf6` (as the *accent*) → `var(--accent)`; keep true brand purple where it's literally the brand mark
   - cyan `#00f0ff`/`#22d3ee` → `var(--c-cyan)`; amber `#f59e0b`/`#fcd34d` → `var(--c-amber)`; green `#22c55e`/`#34d399` → `var(--c-green)`; red `#ef4444` → `var(--c-red)` (use the route's accent for primary emphasis)
   - text `#fff`/`#e5e5e5` → `var(--t-hi)`; `#999`/`#888` → `var(--t-mid)`; `#666`/`#555` → `var(--t-lo)`; `#333` → `var(--t-dim)`
   - borders `rgba(124,58,237,.x)`/`#222`/`#333` → `var(--line)` (subtle) / `var(--line-2)` (stronger)
   - mono font stacks → `var(--f-mono)` (or add the `mono` className); eyebrows → the `eyebrow` className
   - radii → `var(--r-sm|md|lg)`; keep existing px if simpler
3. Wrap distinct content blocks/cards in `<Panel title="…" icon="…">…</Panel>` for the framed
   instrument look (corner brackets + section head). Keep tables/lists/forms and their handlers as-is.
4. Keep existing Tailwind layout utilities; just fix colors/surfaces. Don't fight the layout.
5. For pages that are `<iframe>` wrappers, wrap the iframe in `<InstrumentPage>` with the header
   and let the iframe fill the body.

## Verify
After editing, run `npx tsc --noEmit` and confirm the touched files are clean. Spot-check that
no handler/fetch/state was dropped (diff against the original in your head). Report any route
where the existing logic made a clean wrap hard, and how you preserved it.
