# FD: METTLE // Athlete Progress Tracker

**Status:** Complete
**Owner:** Nova
**Created:** 2026-03-23 01:00
**Lane:** Product prototypes

## Objective
Individual swimmer time progression analyzer with plateau detection, trend analysis, and actionable training recommendations.

## Acceptance Criteria
- [x] Input: athlete info + event selection + time entries (date + time + meet)
- [x] Canvas-rendered progression chart with PB markers, trend line, improvement zone
- [x] Plateau detection via 4-swim window variance analysis
- [x] Pattern recognition: seasonal peaks, meet-type performance, improvement velocity
- [x] Training recommendations: plateau-breakers, sprint/distance-specific, consistency coaching
- [x] 5-tab interface: Overview, Chart, Deep Analysis, Training Recs, Export
- [x] Export: text report, CSV, JSON
- [x] Sample data loader with realistic 12-swim progression

## A/B Context
Previous build this improves on: Meet Scorer (2026-03-22)
Variable changed: Shifts from team-level meet tools to individual athlete longitudinal tracking
Expected improvement: Fills the "individual athlete" gap — all prior METTLE builds are team/meet-level

## What Worked / What Didn't
Linear regression trend line + plateau detection via variance window works well for swim data. The 5-tab layout keeps the dense analytics from overwhelming the coach. Canvas chart with inverted Y-axis (faster = higher) is intuitive for swimming context. Sample data with realistic 13-14 age group 100 Free progression (1:05→1:01) validates the UI at scale. Training recommendations are the highest-value feature — coaches don't just want data, they want next steps.
