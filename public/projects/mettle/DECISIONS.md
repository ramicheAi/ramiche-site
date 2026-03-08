# METTLE — Decision Log

## Architecture

| Date | Decision | Why | Alternatives Considered |
|------|----------|-----|------------------------|
| 2025-Q4 | Next.js 16 + React 19 + Tailwind 4 | Vercel deployment, SSR, modern stack | Remix, Vite+React |
| 2025-Q4 | Firestore (apex-athlete-73755) | Real-time sync, scalable, serverless | Supabase, PlanetScale |
| 2025-Q4 | PIN-based athlete auth | Kids can't manage passwords; 4-digit PIN = frictionless | Firebase Auth, OAuth |
| 2025-Q4 | SHA-256 coach passwords | Simple, no external auth dependency | Firebase Auth, Auth0 |
| 2025-Q4 | localStorage + Firestore dual storage | Offline-first, instant UI, cloud backup | Firestore-only |
| 2026-02 | Service workers BANNED | Caused stale pages, blank screens on Chrome/Safari | Cache-first SW |
| 2026-02 | XP daily cap at 150 | Prevents gaming, keeps progression fair | Uncapped, weekly cap |
| 2026-02 | Stripe for payments ($149/$349/$549) | Industry standard, already wired | Paddle, LemonSqueezy |
| 2026-03 | Server-side redirect /apex-athlete → /coach | Client-side redirect got cached by Vercel CDN | Client-side useEffect |

## Brand

| Date | Decision | Why |
|------|----------|-----|
| 2026-01 | METTLE v5 "Forged M" | Biblical colors (purple, scarlet, gold, blue) — prestigious, game-like |
| 2026-01 | Dark theme ONLY for METTLE | Athlete/gaming aesthetic. Light mode for all other Parallax products |
| 2026-02 | "TeamUnify runs your office. METTLE transforms your athletes." | Competitor positioning |

## Legal

| Date | Decision | Status |
|------|----------|--------|
| 2026-02-17 | Copyright filed | DONE |
| 2026-02 | Patent filing (USPTO, $65 micro entity) | In progress |
| 2026-02 | Trademark Classes 9+41+42 | Recommended, not filed |
