# METTLE — Project Memory

## Beta

- **Organization:** Saint Andrew's Aquatics (240+ athletes, Orlando FL)
- **Coach PIN:** 2451
- **Status:** Closed beta, invite-only

## Brand

- METTLE v5 "Forged M"
- Colors: Purple (#7C3AED), Scarlet (#DC2626), Gold (#EAB308), Blue (#3B82F6)
- Dark theme (exception to Parallax light-mode rule)
- Game-like aesthetic (Fortnite/Fallout), NOT corporate
- SVG icons, not emojis. Prestigious look.

## Pricing

| Tier | Price |
|------|-------|
| Base | $149/mo |
| Mid | $349/mo |
| Premium | $549/mo |
| Enterprise | Custom |

## Legal

- Copyright: Filed & completed Feb 17, 2026
- Patent: Filing in progress at USPTO ($65 micro entity)
- Trademark: Classes 9+41+42 recommended (not filed)

## Gamification

- Levels: Rookie(0) → Contender(300) → Warrior(600) → Elite(1000) → Captain(1500) → Legend(2500)
- Daily XP cap: 150
- Streak multipliers: Bronze(3d, 1.25x) → Mythic(60d, 2.5x)
- Monthly XP resets (seasonXP)

## Key Dates

- Feb 17: Copyright completed
- Feb 27: ByteByteGo 52/52 items implemented
- Mar 2: Service workers banned (stale cache fix)
- Mar 7: Server-side redirect fix, rogue app/ dir removal, portal switcher, demo page polish
- Mar 8: Best Times Fetch (SwimCloud + USA Swimming ID), security hardening (role isolation), 30-day sessions, auto-update pipeline, project docs

## Auth Architecture (Mar 8)

- **Session storage:** localStorage, 30-day expiry
- **Roles:** coach, admin, athlete, parent
- **MASTER_PIN:** env var `NEXT_PUBLIC_MASTER_PIN`, fallback "2451"
- **Portal isolation:** each portal checks `getSession().role` — wrong roles get redirected
- **MASTER_PIN bypass:** only on admin login, NOT on athlete/parent portals
- **CRITICAL LESSON (Mar 8):** Never blank MASTER_PIN during auth refactors. Always verify PIN login works after every auth commit.

## Best Times (Mar 8)

- **Source:** SwimCloud HTML scraping (official API is private/403)
- **Meet Mobile:** No public API, closed app — not viable
- **Matching:** USA Swimming ID (`sdif.swimmer.{id}`) with name fallback
- **Cache:** Firestore, 7-day TTL
- **UI:** "Best Times" section in AthleteDetailView, grouped by course (SCY/LCM/SCM)
- **Known issue:** meet name + date fields return empty — parser needs fix

## Critical Rules

- NEVER edit `repos/apex-athlete-app/` (dead test app)
- Production is ALWAYS `repos/ramiche-site/src/app/apex-athlete/`
- Service workers BANNED
- Verify in browser before reporting "done"
- `no-cache, no-store, must-revalidate` on all METTLE paths
- AUTH CHANGES — ATOMIC ONLY: one commit per change, verify MASTER_PIN after each
