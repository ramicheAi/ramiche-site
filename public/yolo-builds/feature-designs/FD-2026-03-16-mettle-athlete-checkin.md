# FD: METTLE Athlete Check-In

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-16 01:00
**Lane:** Product prototypes

## Objective
Mobile-first kiosk for athletes to self-check-in at practice via 4-digit PIN, earning XP and building attendance streaks while giving coaches real-time roster visibility.

## Acceptance Criteria
- [x] PIN-based check-in with numpad UI
- [x] XP awards on check-in with streak bonuses
- [x] Live roster with search, level badges, and check-in status
- [x] Streak leaderboard with gold/silver/bronze
- [x] Stats dashboard with weekly attendance and activity log
- [x] Coach floating panel with group breakdowns and missing athletes
- [x] LocalStorage persistence (daily state)
- [x] 24 demo athletes seeded across 3 groups

## A/B Context
Previous build this improves on: METTLE Practice Planner (2026-03-14) + METTLE Recruitment Portal (2026-03-15)
Variable changed: Target user — first build targeting ATHLETES directly (not coaches, not parents, not prospects)
Expected improvement: Daily engagement frequency (5x/week athlete touchpoint vs. coach-only tools)

## What Worked / What Didn't
The numpad-based PIN entry with readonly inputs prevents mobile keyboard popup — critical for poolside kiosk use where wet fingers + virtual keyboards = frustration. The coach FAB panel provides instant oversight without leaving the athlete-facing flow. Demo seeding with 9 pre-checked-in athletes makes the roster and stats tabs immediately useful. The XP streak bonus table (escalating from +5 at 3-day to +50 at 7+ day) creates meaningful compounding that athletes will talk about. Key gap: no Firestore integration yet, so it's a standalone prototype — but the data model (checkedIn set + activityLog array) maps cleanly to Firestore collections.
