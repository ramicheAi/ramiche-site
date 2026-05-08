# MEMORY.md — METTLE
*Last Updated: Apr 5, 2026*

## Status
- **Phase:** Coach + Athlete Portal Hardening
- **Current Focus:** Billing, TierBadge, YOLO build infrastructure
- **Latest Deploy:** Next.js 16.2 + TierBadge sport-aware (Apr 5)

## Recent Ships
- **Apr 5:** Next.js 16.2 prefetchInlining, TierBadge sport-aware tier names
- **Apr 1-4:** YOLO build serving via API route, cron calendar parsing fixes
- **Mar 28-31:** Billing page (Grit balance, Season Recap, treasury), auth-session group scoping
- **Mar 25-27:** BestTimesCard qualifying gaps, 3-decision onboarding wizard, GoMotion CSV import
- **Mar 23-24:** BillingView, Observatory, CsvImport, standalone live swim meet tracker
- **Mar 22:** Firebase Auth Phases 1-5, Practice Builder, Churn Detector

## Critical Context
- **Mobile First:** All athlete features must work perfectly on mobile touch screens.
- **Auth:** Uses custom PIN system + Firebase session cookies. Phase 6 (remove localStorage) gated after Apr 22.
- **Data:** Firestore `users/{uid}`, `practices/{id}`, `roster/{id}`.
- **Build:** Vercel CLI deploys broken (362MB bundle) — git push only.

## Next Up
1. Firebase Auth Phase 6 — remove localStorage (after Apr 22)
2. Coach portal cognitive load refactor (4101 lines, 81 useState — HIGH RISK)
3. Stripe subscription billing
4. Optimize load times for large rosters
