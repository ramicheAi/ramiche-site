# METTLE — Architecture

## Production

- **Repo:** `/Users/admin/repos/ramiche-site/src/app/apex-athlete/`
- **Live:** https://ramiche-site.vercel.app/apex-athlete
- **Firebase:** apex-athlete-73755 (Firestore)
- **Deploy:** GitHub push → Vercel auto-deploy
- **CI/CD:** GitHub Actions + security scanning + lint (0 errors)

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16.1.6, React 19.2.3 |
| Styling | Tailwind CSS 4.1.18 |
| Language | TypeScript 5.9.3 |
| Database | Firestore (apex-athlete-73755) |
| Payments | Stripe ($149/$349/$549/Enterprise) |
| Deploy | Vercel (auto from GitHub) |
| Auth | PIN (athletes), SHA-256 hash (coaches), 6-digit code (parents) |
| Storage | localStorage (offline) + Firestore (cloud sync) |

## Routes

| Route | Purpose |
|-------|---------|
| `/apex-athlete` | Redirects → /coach (308) |
| `/apex-athlete/login` | Coach/Parent login |
| `/apex-athlete/coach` | Coach portal (main, ~5400 lines) |
| `/apex-athlete/athlete` | Athlete dashboard (~2800 lines) |
| `/apex-athlete/parent` | Parent portal |
| `/apex-athlete/join?token=XXX` | Invite acceptance |
| `/apex-athlete/guide` | Quickstart guide |
| `/apex-athlete/billing` | Pricing & subscription |
| `/apex-athlete/demo` | Public demo mode |
| `/apex-athlete/landing` | Marketing landing |

## Key Files

```
src/app/apex-athlete/
├── auth.ts              # Session + SHA-256 hashing
├── types.ts             # All TypeScript interfaces
├── constants.ts         # Levels, checkpoints, quests, roster groups
├── invites.ts           # Token gen, invite CRUD
├── utils.ts             # Helpers
├── coach/page.tsx       # Coach portal (5,429 lines)
├── athlete/page.tsx     # Athlete dashboard (2,774 lines)
├── parent/page.tsx      # Parent portal
├── login/page.tsx       # Auth UI
├── demo/page.tsx        # Demo/sandbox
├── lib/
│   ├── game-engine.ts   # XP calc, streaks, level thresholds
│   └── sport-config.ts  # White-label sport definitions
└── components/
    ├── GameHUDHeader.tsx # Leaderboard display
    ├── AnimatedCounter.tsx
    ├── StreakFlame.tsx
    └── Card.tsx
```

## Firestore Collections

- `config/invites` — Shareable invite links
- Athlete documents (keyed by athleteId)
- Coach accounts (localStorage primary, Firestore sync)
- Audit logs

## Features (Complete)

- Gamification engine (6 levels, XP, streaks, daily cap 150)
- Meet management (Hy-Tek parser, seed times, heat/lane, splits, PR detection)
- Checkpoint system (Pool 13, Weight 3, Meet 3 checkpoints)
- Quest system (5 categories, 10+ quests)
- Team challenges (weight + team)
- Schedule management (weekly templates, 7 roster groups)
- Wellness tracking (mental readiness, breathwork, journal, recovery)
- Analytics (daily snapshots, streaks, audit log)
- Invite system (token-based, role-specific)
- White-label sport configs (swimming, football)
- Billing (Stripe, 3 tiers)
