# Handoff: Parallax OS — Command Center Redesign

## Overview
**Parallax OS v4** is a complete visual + interaction redesign of the Parallax
Command Center — the single cockpit one founder uses to run a venture studio
(20 AI agents, jobs, finance, prospecting, integrations). The design language is
a cinematic "operating system from another world": a holographic starship bridge
that blends JARVIS-style instruments, Star Wars cockpit hardware, Apple-grade
restraint, and the house **Galactik Antics** collectible brand. It is **calm at
rest, alive in motion**, and ships in both **dark (primary)** and **light
("Daylight")** themes.

The target codebase is the existing **`ramicheAi/ramiche-site`** repo: Next.js 16
(App Router, `src/`), React 19, TypeScript. Command Center routes live under
`src/app/command-center/**/page.tsx`; shared chrome under
`src/components/command-center/`. This is a **reskin — do not change existing
logic/APIs** (Jobs, Builder, Prospector, Sales, Nexus, Nerve Center all call real
endpoints). Must `npm run build` clean and pass `npx tsc --noEmit`.

---

## About the Design Files
The files in `prototype/` are a **design reference built in HTML/CSS + React-via-Babel**.
They are a working, interactive prototype that demonstrates the intended look,
motion, and behavior — **not** production code to paste in. The Babel-in-browser
JSX, the global `window.*` module pattern, and the multi-file `<script>` loading
are prototype conveniences only.

**Your task:** recreate these designs inside `ramiche-site`'s existing
environment — real React 19 components, TypeScript, the project's styling
approach (Tailwind v4 + the proposed token module) — using its established
patterns. Lift exact values (hex, spacing, type, motion) from the prototype CSS;
re-architect the structure to idiomatic Next.js. If a piece of the prototype
conflicts with an existing component's API, keep the API and restyle.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion, and
interactions are all specified. Recreate pixel-faithfully using the codebase's
libraries. The prototype's computed values are the spec — when in doubt, open the
HTML and inspect.

---

## How to run the prototype
Open `prototype/Parallax OS.html` in any modern browser (it loads React, ReactDOM,
and Babel from unpkg, and three Google Fonts; needs network on first load). It
boots once per session (press any key to skip the ignition sequence). Toggle
light/dark with the sun icon in the top HUD. Open the **Tweaks** panel (host
toolbar) for Sanctuary on/off, Canopy atmosphere, Sound cues, Breathing motion.

---

## Design Tokens
All tokens live in **`cc-theme.ts`** (top of this bundle) — drop it at
`src/lib/cc-theme.ts`. Source of truth for the values below.

### Brand colors
| Token | Hex | Use |
|---|---|---|
| `purple` | `#7c3aed` | Primary brand / default accent |
| `purpleL` | `#a855f7` | Lighter purple (glows, cores) |
| `gold` | `#C9A84C` | Secondary brand (ATLAS, finance, leader) |
| `goldL` | `#e6c668` | Lighter gold |

### Per-section accent spectrum (each route tints to its own accent)
pink `#ec4899` · green `#34d399` · amber `#f59e0b` · cyan `#22d3ee` · red `#ef4444`
· indigo `#818cf8` · teal `#14b8a6` · rose `#f472b6` · orange `#f97316` ·
sky `#38bdf8` · fuchsia `#c084fc` · violet `#9b5de5`. Mapping per route is in
`SECTION_ACCENT` (cc-theme.ts). The page sets `--accent` and everything inherits.

### Surfaces — DARK (primary)
`--void #050507` · `--ink-0 #08080d` · `--ink-1 #0c0c14` (panel) · `--ink-2 #11111b`
· `--ink-3 #181824` · hairline `rgba(150,130,220,.12)` · hairline-2
`rgba(168,130,255,.26)` · text-hi `#f4f5fb` · text-mid `#97a0b8` · text-lo
`#5e6680` · text-dim `#353a4d` · panel-glass `rgba(14,14,24,.62)`.

### Surfaces — LIGHT ("Daylight")
`--void #eceaf4` · `--ink-0 #f4f2fa` · `--ink-1 #ffffff` · hairline
`rgba(80,50,140,.13)` · text-hi `#15121f` · text-mid `#5a5274` · text-lo `#8b86a3`
· panel-glass `rgba(255,255,255,.74)`. **Accent darkens** in light mode: purple →
`#6d28d9`, gold → `#9a7b1f` (AA contrast).

### Holographic gradients
- Foil / text: `linear-gradient(115deg,#a855f7,#38bdf8,#34d399,#C9A84C,#ec4899,#a855f7)`
- Prism edge / orb: `conic-gradient(from 210deg,#a855f7,#38bdf8,#34d399,#e6c668,#ec4899,#7c3aed,#a855f7)`

### Type
| Family | Use |
|---|---|
| **Space Grotesk** (300–700) | UI / display |
| **Chakra Petch** (400–700) | "tech" labels, agent names, big numerals, instrument titles |
| **JetBrains Mono** (400–600) | mono — serials, eyebrows, readouts, timestamps; tabular numerals |

Eyebrow style: mono, ~9.5px, `letter-spacing:.22–.28em`, uppercase, text-lo.

### Radii / Motion
Radii: xs 3 · sm 7 · md 11 · lg 16 · xl 24 · pill 999 (px).
Easing: `--ease cubic-bezier(.16,1,.3,1)`, `--ease-io cubic-bezier(.65,0,.35,1)`.
Durations: fast 140ms · med 320ms · slow 640ms.

### Signature motifs (reusable)
- **Corner brackets** (`.inst-cnr` tl/tr/bl/br) — small L-shaped accent corners on
  instrument panels.
- **Serial codes** — mono strings like `SYS·02A156·8203`, deterministic per
  page/module (hash of id). Pure flavor; generators in `po-pages.jsx`.
- **Parallax echo** (`.echo`) — duplicated headline offset behind itself in accent.
- **Tick ruler** — row of unequal vertical ticks under page titles.
- **Ring / arc gauges** — 270° SVG arc gauge; fill animates on value change.

---

## Global Layout / Shell
`po-shell.jsx` + `po-ui.css`. A fixed full-viewport app:
- **Left sidebar** (244px; collapses to 56–66px icon rail ≤1024px). Logo + version,
  then a **single-open accordion**: 5 sections (Operations, Business, Creative,
  Specialist, Workspace), only the active section expanded; collapsed sections
  show a rolled-up badge count; chevron rotates; height animates via
  `grid-template-rows 0fr→1fr`. ~35 routes total (full list in `po-data.jsx` `NAV`).
- **Top HUD** (64px): ⌘K command bar ("Jump to anything · ask ATLAS · run a
  command"), live readouts (Agents 19/20, Gateway ONLINE, MRR), a **live ticking
  clock**, theme toggle, "Ask ATLAS" button.
- **Global alert ticker** (`.po-alertbar`): red strip under the HUD when any
  instrument crosses critical; scrolls the offending modules; click → routes to
  the source page. Driven by `window.poAlertBus` (a tiny pub/sub).
- **Background**: parallax starfield + nebula + diagonal "rift" (`po-canopy.css`),
  all mouse-reactive, all gated by reduced-motion / the "Canopy" tweak.
- **Command palette** (⌘K): fuzzy list of pages, agents, and commands, plus a
  "Run as Job — '…'" dispatch row. Arrow/enter nav.

---

## Screens / Views

### 1 · Sanctuary (default dashboard) — `po-sanctuary.jsx`
- **Purpose:** the 2am "what do I do next?" view. Radical calm.
- **Layout:** centered. A single luminous **golden throne** (orb of light, breathing
  glow, concentric rings, targeting reticle) in a vast field.
- **Constellation nav:** 6 primary domains as points of light arranged around the
  throne (Comms, Agents, Finance, Observatory, Tasks, App Builder), each a colored
  dot + label + count.
- **One truth line:** `19/20 online · $48.2k · 7 jobs · 23 shipped`.
- **The Word:** a single pill input "Speak intent…" (opens ⌘K). Below it the one
  directive that needs the user.
- **Corner:** theme toggle + "expand to full Command Center" (grid icon → rich
  dashboard). Toggleable via the "Sanctuary" tweak.

### 2 · Command Center (full dashboard) — `po-command.jsx` + `po-stage.jsx`
- **3D holographic stage:** a wireframe-globe arc-reactor core with triple gimbal
  rings on independent axes; the **agent fleet orbits in 3D** (character avatars
  scale/dim by depth); four floating instrument gauges (Agents/MRR/Jobs/Shipped)
  with connector lines, **arc reticles that drift live**; perspective floor grid,
  rising data motes, scanlines; whole scene tilts to the cursor.
- **ATLAS directive bar**, **vitals strip**, **fleet list**, **live git/activity feed**.

### 3 · Comms (access all chats) — `po-chat.jsx` + `po-console.jsx`
- **Conversation list:** channels (`#general`, `#mettle`, `#verified-agents`,
  `#launch-room` with unread badges) + agent DMs (with character-face avatars +
  status pips), tabs (All/Channels/Direct), search.
- **Active conversation:** streaming agent replies (typewriter), **inline Job cards**
  (steps + progress that advance live) and **Data cards** (lead tables, MRR
  sparkline). Composer with attach, voice waveform, send, and a **"Run as Job"**
  toggle. Suggested-action chips.

### 4 · Agents (collectible roster) — `po-pages.jsx`
- Grid of 20 **collectible character cards**. Each: a real Galactik Antics render in
  a holographic "bay" (pedestal glow + faction emblem), rarity ribbon
  (Mythic/Epic/Rare/Common), status, nameplate. **Click flips the card** to a
  dossier back (level, Power/Speed/Intel/Sync stat bars, bio, "Open direct line").

### 5 · Finance HQ — `po-pages.jsx`
- Instrument header; a giant **MRR figure that climbs live**; LIVE tag; area chart
  with a pulsing beacon; four ring-gauge tiles (Net New MRR / New Logos / Churn /
  Runway); a **transaction stream** where new deals flash in gold at the top.

### 6 · Observatory — `po-pages.jsx`
- A radar: central gas-giant world (`characters/11.png`), **6 signal blips orbiting**
  in real time (rose if confidence >85%, else violet), confidence %s ticking;
  click a blip or list row to lock on (ping ring).

### 7 · App Builder — `po-pages.jsx`
- Living build console: an advancing build pipeline, streaming build queue + stdout
  log, deploy-target cards.

### 8 · Nerve Center — `po-pages.jsx`
- **Integration mesh:** ATLAS gold core + 7 service nodes (Gateway, Slack, Linear,
  Stripe, GitHub, Vercel, OpenAI) in faction colors, connector lines, **data packets
  that travel along the links** toward the core; a live signal-traffic feed.

### 9 · Gallery — `po-pages.jsx`
- 4-col **render wall** of the 11 characters as rarity-framed plates; click → a
  **lightbox holo-bay** (large render, caption, `01/11` index, ←/→/Esc nav).

### 10 · Instrument pages (Tasks, Security, Strategy, Sales, Proposals, Legal,
Health, etc.) — `Scaffold` in `po-pages.jsx`
- Every remaining route renders a consistent **instrument console**: instrument
  header (serial, ONLINE light, tick ruler) + a grid of 6 telemetry modules, each
  with a ring gauge, label, serial, big % value, NOMINAL/MONITOR/ALERT status, and
  a waveform. **Values drift live**; crossing ≥90% flips a module to red **ALERT**
  (glitch + alarm glow), fires a toast, and surfaces on the global alert ticker.
  Per-page module labels are in `modulesFor(id)`.

### 11 · Ignition / Boot — `po-shell.jsx` + `po-boot.css`
- Once-per-session startup overlay: glowing core + rings + crosshair, "PARALLAX OS
  v4" title, a **system log that types real fleet counts** (`SPINNING UP FLEET · 20
  OPERATIVES … 14 ONLINE`), a fill bar, "press any key to skip", then dissolves.

---

## Interactions & Behavior
- **Theme**: `data-po-theme="dark|light"` on root; persisted in `localStorage("po-theme")`.
- **⌘K / Ctrl-K**: command palette anywhere.
- **Live drift**: instrument values, dashboard gauges, Finance MRR, Observatory
  signals all update on intervals (1.5–2.6s). Comms job/data cards stream.
- **Alerts**: `poAlertBus.set/clear(key, {label,value,page,pageLabel,serial})`.
  Edge-detected in a post-render effect (never during render — see note below).
- **Sound**: `window.poSound.play("nav"|"dispatch"|"success"|"alert"|"boot")`, off
  by default (autoplay-safe), toggled in Tweaks. Map to the existing
  `src/lib/cc-sounds.ts` Web Audio synth.
- **Reduced motion**: every animation gates on `prefers-reduced-motion` **and** a
  `.po-still` class (the "Breathing motion" tweak). Honor both.
- **Responsive**: `po-mobile.css` — ≤1024 sidebar→icon rail + grids reflow; ≤640
  phone — stacked Comms, shrunk stage, fitted Sanctuary, trimmed HUD.

## State Management (per the prototype; re-implement idiomatically)
- `active` route id; `openSec` (accordion); `theme`; `booting` (session-gated);
  toast; alerts (from the bus). Each living page owns its interval-driven local
  state (module values, MRR, signals, feeds) with a `prevCrit` ref for edge
  detection. In Next.js, back the live numbers with real data sources; keep the
  drift/animation as a presentation layer.

### ⚠️ Implementation gotcha (carried from the prototype)
Side effects that update a *parent* (toasts, the alert bus) must fire from a
**post-render `useEffect`** keyed on the data — never inside a `setState` updater —
or React throws "Cannot update a component while rendering a different component."
The prototype's `Scaffold` uses a pure updater + a separate reconcile effect with a
`prevCrit` ref. Preserve that pattern.

---

## Assets
All in `prototype/` (and `prototype/public/assets/characters/`):
- **`po-logo-mask.png`** — the real Parallax "P" logomark, used as a CSS mask filled
  with the holographic conic gradient (`.po-logomark`). Sourced from the user's
  uploaded logo. In the real app, prefer an SVG of the mark if available.
- **`public/assets/characters/1.png … 11.png`** — the real **Galactik Antics**
  character renders (imported from the `ramicheAi/galactik-antics` repo,
  `public/assets/characters/`). #1–#10 are characters, **#11 is a planet/world**
  (used in Observatory). Character→agent mapping is in `po-data.jsx` (`AGENTS[].char`),
  matched by personality/role. These already exist in the target monorepo's sibling
  repo — wire to the real asset paths there rather than re-importing.
- Fonts: Space Grotesk, Chakra Petch, JetBrains Mono (Google Fonts).
- No other external images. All other graphics are pure CSS/SVG.

---

## Files (in `prototype/`)
**Entry:** `Parallax OS.html` (load order matters — see its `<script>`/`<link>` tags).

**Styles:** `po-theme.css` (tokens) · `po-holo.css` (holographic materials) ·
`po-canopy.css` (background atmosphere) · `po-ui.css` (shell, sidebar, HUD, palette,
toast, alert ticker) · `po-command.css` · `po-stage.css` (3D console) · `po-avatar.css`
(character face tokens) · `po-chat.css` · `po-console.css` · `po-pages.css` (all page
surfaces + instruments) · `po-sanctuary.css` · `po-boot.css` · `po-mobile.css`.

**Logic/markup (React via Babel):** `po-brand.jsx` (logo + icon set) · `po-data.jsx`
(NAV, 20 agents, channels/DMs, mappings) · `po-sound.jsx` · `po-avatar.jsx` ·
`tweaks-panel.jsx` (host tweaks shell) · `po-stage.jsx` · `po-command.jsx` ·
`po-sanctuary.jsx` · `po-chat.jsx` · `po-console.jsx` · `po-pages.jsx` (Agents,
Finance, Observatory, App Builder, Nerve Center, Gallery, Scaffold) · `po-shell.jsx`
(app root, sidebar, HUD, palette, alert bus, boot).

**Token module (top level):** `cc-theme.ts` — drop at `src/lib/cc-theme.ts`.

---

## Suggested implementation order
1. Land `cc-theme.ts`; inject CSS vars + `data-po-theme` in
   `src/app/command-center/layout.tsx`; load the 3 fonts.
2. Reskin the **Sidebar** (accordion) + **CommandHUD/CommandPalette** + alert ticker.
3. Build the **Sanctuary** landing and the **full dashboard** (3D stage can be a
   progressive enhancement — ship a static instrument version first if needed).
4. Reskin **Comms** (keep existing chat/streaming logic), then **Agents**.
5. Port the **Scaffold** instrument pattern; apply to all remaining routes; wire real
   metrics into the gauges/alerts.
6. Build the showpieces: **Finance HQ, Observatory, App Builder, Nerve Center, Gallery.**
7. Wire **sound** to `cc-sounds.ts`; add the **boot** sequence; QA reduced-motion,
   both themes, mobile, and `npm run build` / `tsc`.
