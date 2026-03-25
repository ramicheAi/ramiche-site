# FD: METTLE Workout Log

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-18 01:04
**Lane:** Product prototypes

## Objective
Mobile-first athlete workout journal — swimmers log daily practice performance (yardage, RPE, set types, focus areas, notes), track volume with weekly charts, and earn XP for consistency.

## Acceptance Criteria
- [x] 4-tab interface: Log, History, Stats, Goals
- [x] Full workout entry form with set types, volume, RPE slider, focus tags, notes
- [x] XP calculation with bonuses (effort, volume, variety, streak)
- [x] Weekly bar chart and stats dashboard
- [x] Goals system with progress bars
- [x] Demo data seeded with realistic swim practice data
- [x] LocalStorage persistence
- [x] Long-press delete with confirmation
- [x] METTLE brand colors (purple, scarlet, gold, blue)

## A/B Context
Previous build this improves on: METTLE Athlete Check-In (2026-03-16)
Variable changed: Check-In tracks attendance (binary: present/absent). Workout Log tracks performance quality (continuous: yardage, RPE, focus areas, notes).
Expected improvement: Deeper athlete engagement — reflection creates intentional training habits vs. simple attendance tracking.

## What Worked / What Didn't
Single-file HTML with vanilla JS continues to be the fastest path to a working prototype. RPE slider with color gradient is immediately intuitive. XP preview on the submit button creates anticipation before logging. Demo data seeded with realistic swim coach language (negative splits, threshold sets, race pace) makes the tool feel authentic. Key constraint: the gap between Practice Planner (coach sets the workout) and Workout Log (athlete records results) is exactly where future integration should happen — coach creates the plan, athlete logs how it went, creating a closed feedback loop.
