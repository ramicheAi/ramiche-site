# Command Center — Visual & Sound Design Brief (for Claude Design)

**Goal:** Reskin the Parallax Command Center into a cockpit that feels unlike anything ever built — the bridge of a starship operated by one founder. It must stay **simple and instantly understood** even while looking cinematic. Function first; the chrome serves clarity, never fights it.

## The blend (the soul of the look)
- **Tony Stark / JARVIS** — calm, confident HUD. Translucent panels, thin glowing edges, data that breathes (subtle motion), a voice/assistant presence. Nothing cluttered; everything one glance away.
- **Galactik Antics** — the house brand: bold, playful-premium, collectible energy, the cyan `#00f0ff` electric accent, cosmic depth.
- **Star Wars** — control-panel legibility (readouts, status lights, segmented displays), lived-in hardware, faction-clear color coding.
- **Apple** — restraint, hierarchy, whitespace, type discipline, motion that means something. If Stark designed at Apple.
- **Cinematic sci-fi** — depth, parallax, volumetric glow, scanlines used sparingly, a sense the system is *alive*.

## Non-negotiables
1. **Simplicity wins.** Every screen answers "what do I do next?" in under 2 seconds. Cinematic ≠ busy.
2. **One cohesive system.** Centralized design tokens (color, glow, radius, type, spacing, motion). No more per-page inline-style drift.
3. **Real-time everywhere.** Live values pulse; transitions are smooth; nothing pops jarringly.
4. **Accessible.** AA contrast, motion-reduce support, focus states.

## Color system (extend, don't replace the dark base)
- Base: near-black `#0a0a0a` / panels `rgba(255,255,255,0.02–0.06)` with thin `1px` luminous borders.
- Faction accents (keep meaning consistent across the app):
  - **Command/primary:** violet `#7c3aed → #a855f7`
  - **Galactik electric:** cyan `#00f0ff`
  - **Money/win:** green `#22c55e` · **gold** `#C9A84C`
  - **Caution:** amber `#f59e0b` · **Alert:** red `#ef4444`
- Glow as a first-class token (e.g. `--glow-cmd: 0 0 24px rgba(124,58,237,.35)`).

## Type & icons
- Display: a confident geometric/grotesk for numbers & headers (Stark readouts). Body: Inter/system for legibility.
- **Custom icon set:** one unified, simple line/glyph family — geometric, slightly futuristic, instantly readable. No emoji in the final system; bespoke glyphs for each section (Jobs ⚡, Prospector 🌐, Builder ⚒ → replace with custom marks). Each section keeps its accent.

## Motion
- Panel enter: subtle fade + 4px rise. Live dots: soft pulse. Job running: shimmer. Page transitions: 150–200ms ease. Parallax starfield in the deep background (very low opacity) for depth.

## Sound (already scaffolded — `src/lib/cc-sounds.ts`, Web Audio synth)
Cinematic, short, never annoying; user-mutable. Refine these cues:
- `boot` (enter CC), `dispatch` (launch a job), `success` (job done), `alert` (job failed / needs you), `notify` (passive), `tap` (toggles). Keep them tonal, clean, JARVIS-calm. Consider a one-time low "power-on" swell on unlock.

## Apply order (skin working features last → first)
1. Tokens module + global theme (single source).
2. Top HUD + command bar (the JARVIS bar).
3. Dashboard (mission control).
4. The new control surfaces: Jobs, Builder, Prospector, Nexus, Nerve Center.
5. Everything else inherits the tokens.

## Definition of done
A first-time viewer says "I've never seen anything like this" — and a tired founder at 2am still finds the one button they need instantly.
