# Claude Design — Command Center Visual Overhaul (copy-paste brief)

You are redesigning the **Parallax Command Center** — the single cockpit one founder uses to run an entire venture studio. Make it look **otherworldly — like nothing that has ever shipped on the web** — while staying **dead simple to operate**. Cinematic, not cluttered. If a tired founder at 2am can't find the one button they need in 2 seconds, the design failed.

## The repo (everything you need is here)
- **Location:** `/Users/admin/ramiche-site` (this Mac).
- **Stack:** Next.js 16 (App Router, **`src/` directory**), React 19, TypeScript. Styling today is a mix of **inline `style={{}}` objects** and **Tailwind v4** — you may standardize onto a token system.
- **Command Center lives in:**
  - Pages: `src/app/command-center/**/page.tsx` (dashboard is `src/app/command-center/page.tsx`)
  - Shared chrome: `src/components/command-center/` (`Sidebar.tsx`, `CommandHUD.tsx`, `CommandPalette.tsx`, docks)
  - Layout + PIN gate: `src/app/command-center/layout.tsx`
  - Sound system (already built, Web Audio synth): `src/lib/cc-sounds.ts`
  - Existing written brief: `CC-DESIGN-BRIEF.md` (read it — colors, motion, sound, apply-order)
- **Run it:** `cd /Users/admin/ramiche-site && npm run dev` → http://localhost:3000/command-center
- **Build:** `npm run build`. **Typecheck:** `npx tsc --noEmit`. **Lint:** `npx eslint src`.
- **Get past the PIN gate** to see the real pages: in the browser console run
  `sessionStorage.setItem('cc-pin-auth', JSON.stringify({ok:true,ts:Date.now(),lastActivity:Date.now()}))` then reload.
- Production is served from a build via the `com.command-center` LaunchAgent behind a Cloudflare tunnel at `command.parallaxvinc.com`. So: **it must `npm run build` cleanly.**

## The aesthetic — go otherworldly
Blend, then push past every reference into something new:
- **JARVIS / Tony Stark HUD** — translucent depth, thin luminous edges, data that breathes, an assistant *presence*. Calm confidence.
- **Galactik Antics** (house brand) — cosmic, collectible, electric cyan `#00f0ff`, playful-premium.
- **Star Wars cockpit** — segmented readouts, status lights, faction-clear color, lived-in hardware.
- **Apple** — restraint, hierarchy, whitespace, type discipline, meaningful motion.
- **Cinematic sci-fi** — volumetric glow, parallax starfield depth, holographic panels, scanlines used with extreme restraint.
> Out-of-the-box mandate: invent a signature visual language — a bespoke "operating system from another world." Custom geometry, a unique grid, holographic materials, a one-of-a-kind icon family (no stock icons, no emoji in the final system). It should feel like operating a starship that Apple designed.

## Hard constraints (non-negotiable)
1. **Simplicity wins** — cinematic ≠ busy. Every screen answers "what do I do next?" instantly.
2. **One token system** — centralize color, glow, radius, type, spacing, motion (kill the per-page inline drift). Propose `src/lib/cc-theme.ts` (or CSS vars) as the single source.
3. **Keep it functional** — do not break existing wiring (Jobs, Builder, Prospector, Sales, Nexus, Nerve Center all call real APIs). Reskin, don't rip out logic.
4. **Accessible + fast** — WCAG AA contrast, `prefers-reduced-motion` support, focus states, 60fps. Must `npm run build` with no type errors.
5. **Sound-aware** — cues already exist in `src/lib/cc-sounds.ts`; design the moments they fire (dispatch/success/alert) and refine if useful.

## Deliverables (in order)
1. **3 distinct visual directions** for the dashboard + command bar (screenshots/mockups) — meaningfully different, each otherworldly. Label them so I can pick.
2. After I pick: a **token module + global theme** + a restyled **top HUD/command bar** and **dashboard** as the reference implementation.
3. Roll the tokens across the new control surfaces (Jobs, Builder, Prospector, Nexus, Nerve Center), then everything else inherits.
4. A bespoke **icon set** + the **motion/glow spec**.

## Definition of done
A first-time viewer says "I've never seen anything like this," and a tired founder still finds the one button instantly. Ship it building clean.
