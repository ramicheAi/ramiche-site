# MEMORY.md — METTLE
*Last Updated: Mar 23, 2026*

## Status
- **Phase:** Athlete Portal Beta
- **Current Focus:** Athlete Daily Dashboard & Workout Logging
- **Latest Deploy:** Athlete Onboarding Wizard (5-step flow)

## Recent Ships
- **Mar 23:** Athlete Onboarding Wizard (PIN check, profile, goals, events, tutorial)
- **Mar 22:** Practice Builder mobile drag-and-drop fixes (Safari touch handling)
- **Mar 22:** Churn Detector integration
- **Mar 22:** Firebase Admin SDK + Session Cookies (Auth Phase 5)

## Critical Context
- **Mobile First:** All athlete features must work perfectly on mobile touch screens.
- **Auth:** Uses custom PIN system + Firebase session cookies.
- **Data:** Firestore `users/{uid}`, `practices/{id}`, `roster/{id}`.

## Next Up
1. Athlete Dashboard (Today's practice, upcoming meets)
2. Workout Logger (Input results for sets)
3. Leaderboard (Rankings based on practice performance)
