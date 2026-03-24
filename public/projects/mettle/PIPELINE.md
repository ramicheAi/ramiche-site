# PIPELINE.md - Mettle (Apex Athlete)

## Build Queue
- [ ] Firebase Auth Phase 6 — remove localStorage (after Apr 22)
- [ ] Coach portal refactor — extract hooks (HIGH RISK, needs atomic approach)
- [ ] Stripe subscription billing

## Recent Deploys
- **Mar 23 02:48**: Athlete Onboarding Wizard (6e6e900) — verified 200
- **Mar 22 23:20**: Mobile Safari drag-and-drop fix (3fe1e90) — verified 200
- **Mar 22 19:42**: Practice Builder + Churn Detector (c8b42b9) — verified 200
- **Mar 22 17:05**: Firebase Auth Phase 5 — Admin SDK + middleware (94f758b)
- **Mar 22 16:50**: Firebase Auth Phase 3 — Parent dual-write (756a507)
- **Mar 22 16:45**: Firebase Auth Phase 2 — Coach dual-write (6ae1644)
- **Mar 22 16:30**: Firebase Auth Phase 1 — SDK wrapper (401d0dc)
- **Mar 22 15:35**: Meet Scorer integration (9497ebc)
- **Mar 22 15:20**: Pricing Modeler (e31ecb5)
- **Mar 17 11:35**: Coach components + Nerve Center (9328b75)
- **Mar 16**: PracticePlanner + AthleteCard

## Branch Strategy
- `main`: Production (all deploys via git push)
- Vercel CLI deploys broken (362MB bundle issue) — git push only

## Coach Workflow (complete)
Practice Builder → Relay Optimizer → Heat Sheet Generator → Meet Scorer → Post-Race Analysis → Churn Detector
