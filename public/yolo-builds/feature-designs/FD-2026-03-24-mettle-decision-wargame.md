# FD: METTLE // Decision War Game

**Status:** Complete
**Owner:** Dr Strange
**Created:** 2026-03-24 02:30
**Lane:** Scenario modeling

## Objective
Interactive branching scenario engine where operators model business decisions (pricing changes, hiring, feature launches, acquisitions) and see cascading 12-month impacts across revenue, churn, market share, and team growth.

## Acceptance Criteria
- [x] 16 strategic decisions organized by quarter
- [x] Simulation engine with saturation, moat effects, compounding
- [x] Canvas-rendered MRR trajectory with baseline comparison
- [x] 3-path comparison (baseline, scenario, optimal)
- [x] Sensitivity analysis with 8 variable stress tests
- [x] 3 export formats (JSON, CSV, text summary)

## A/B Context
Previous build this improves on: 2026-03-20-mettle-monte-carlo (not logged — likely failed build)
Variable changed: Structured decision trees with cascading effects vs pure randomized Monte Carlo
Expected improvement: Actionable strategic insight vs probabilistic noise

## What Worked / What Didn't
Decision catalog approach with per-quarter grouping makes the tool intuitive — coaches/operators think in quarters, not continuous timelines. Market saturation dampening (acquisition slows as you approach TAM) prevents unrealistic hockey-stick projections. The sensitivity analysis panel is the highest-value feature — instantly shows which variables matter most. Canvas chart rendering with decision markers (gold vertical lines) makes the impact of each choice visually obvious. Keeping it to 16 decisions (4 per quarter) prevents decision fatigue while covering the major strategic levers.
