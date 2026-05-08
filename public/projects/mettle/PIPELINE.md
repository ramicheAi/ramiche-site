# PIPELINE.md - Mettle (Apex Athlete)

## Build Queue
- [ ] Firebase Auth Phase 6 — remove localStorage (after Apr 22)
- [ ] Coach portal refactor — extract hooks (HIGH RISK, needs atomic approach)
- [ ] Stripe subscription billing

## Recent Deploys
- **Apr 5**: Next.js 16.2 prefetchInlining + TierBadge sport-aware (8d895be, fd68fbb)
- **Apr 1-4**: YOLO build path fixes, cron calendar parsing (a9d199b, 8d35286)
- **Mar 28-31**: Billing page, auth-session group scoping, GritPointsBalance (fc9f797, 4e117a7, 4569d59)
- **Mar 25-27**: BestTimesCard qualifying gaps, onboarding wizard, GoMotion CSV (9845d25, dec3c48, 87fde9d, a8d8a21)
- **Mar 23-24**: BillingView, Observatory, CsvImport, lint fixes (b79d2e9, 1799453, e14efbf)
- **Mar 23 02:48**: Athlete Onboarding Wizard (6e6e900) — verified 200
- **Mar 22**: Firebase Auth Phases 1-5, Practice Builder, Churn Detector, Meet Scorer

## Branch Strategy
- `main`: Production (all deploys via git push)
- Vercel CLI deploys broken (362MB bundle issue) — git push only

## Coach Workflow (complete)
Practice Builder → Relay Optimizer → Heat Sheet Generator → Meet Scorer → Post-Race Analysis → Churn Detector
