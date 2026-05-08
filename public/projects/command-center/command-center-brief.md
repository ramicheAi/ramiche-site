# Command Center 3D Agent Workspace Upgrade

## Context
You are working on `/Users/admin/.openclaw/workspace/repos/ramiche-site/src/app/command-center/page.tsx` (3125 lines).
This is a Next.js 16 + React 19 + Tailwind 4 project. NO dark mode — this page uses a dark space theme inherently.

## Task
Upgrade the Agent Network section (around line 1522-2000) to be a fully immersive 3D animated workspace.

### Design Vision: "THE BRIDGE" — A Space Station Command Bridge
Think Star Trek bridge meets cyberpunk industrial hangar. Each agent has their own WORKSTATION within this shared bridge.

The concept: a large isometric/perspective room viewed from above. The room has:
- **Central command platform** — Atlas stands here with holographic displays around him
- **Workstation pods** arranged in a semi-circle or grid around the bridge
- **Each agent's workstation** has:
  - Their 3D avatar (already have PNGs at `/agents/[name]-3d.png`)
  - A holographic screen showing their work (use WORKSTATION_THEMES already defined)
  - A glowing platform/desk in their signature color
  - Ambient particles in their color
  - Status indicator (active = pulsing green, idle = dim, done = blue)
- **The room itself** has:
  - Perspective-transformed floor with a grid pattern
  - Ambient lighting from each active agent's station
  - Data streams flowing between connected agents (animated SVG paths)
  - Stars/space visible through "windows" at the top
  - Industrial/tech wall panels on the sides

### Key Requirements
1. Use CSS 3D transforms (`perspective`, `rotateX`, `translateZ`) — NOT Three.js (too heavy for this page)
2. Each workstation is clickable → opens the existing chat panel
3. Active agents have more glow, animation, particles
4. Idle agents are dimmed but still visible
5. The whole scene should feel ALIVE — subtle animations everywhere
6. Keep the existing AGENTS array, WORKSTATION_THEMES, AGENT_IMG maps
7. Keep the existing chat panel, model switching, and group chat functionality
8. Mobile responsive — on small screens, fall back to a grid of agent cards

### Also Do
1. Make the chat panel more prominent — slide-in from right, full height
2. Add a "GROUP CHAT" button at the top of the agents section that opens group chat mode
3. Model switching should be accessible from each agent's workstation (click gear icon)
4. Remove any references to "RAMICHE HQ" from navigation or links

### Agent Color Map (already in code)
Atlas=#00f0ff, TheMAESTRO=#f59e0b, SIMONS=#22d3ee, Dr.Strange=#a855f7,
SHURI=#34d399, Widow=#ef4444, PROXIMON=#f97316, Vee=#ec4899,
Aetherion=#818cf8, MICHAEL=#06b6d4, Prophets=#d4a574, SELAH=#10b981,
MERCURY=#fbbf24, ECHO=#38bdf8, HAVEN=#4ade80, INK=#c084fc,
NOVA=#14b8a6, KIYOSAKI=#fcd34d, TRIAGE=#f472b6, THEMIS=#d4a574

### CSS Animations Needed (add to globals.css or inline)
- `@keyframes workstation-hum` — subtle scale pulse for active workstations
- `@keyframes data-flow` — animated dash offset for SVG connection lines
- `@keyframes hologram-flicker` — slight opacity flicker for screens
- Any existing animations (agent-float, chibi-bounce, platform-glow etc.) are already in globals.css

### DO NOT
- Remove any existing functionality (chat, model switching, weather, scripture, schedule, health, missions)
- Add Three.js or any heavy 3D library
- Change the overall page layout outside the agent section
- Remove the static AGENTS/MISSIONS/OPPS/etc. data arrays

### Build After Changes
Run: `cd /Users/admin/.openclaw/workspace/repos/ramiche-site && npm run build`
Fix any TypeScript/build errors before finishing.

When completely finished, run this command to notify me:
openclaw system event --text "Done: 3D Command Center workspace built with immersive agent bridge" --mode now
