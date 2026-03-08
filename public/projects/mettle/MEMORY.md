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
- Mar 7: Server-side redirect fix (308), rogue app/ dir removal, portal switcher restored, duplicate Parent tab fixed, demo page step 1 polish
- Mar 8: Project structure verified + updated

## Critical Rules

- NEVER edit `repos/apex-athlete-app/` (dead test app)
- Production is ALWAYS `repos/ramiche-site/src/app/apex-athlete/`
- Service workers BANNED
- Verify in browser before reporting "done"
- `no-cache, no-store, must-revalidate` on all METTLE paths
