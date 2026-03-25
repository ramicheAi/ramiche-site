# FD: METTLE // Season ROI Calculator

**Status:** Complete
**Owner:** Simons
**Created:** 2026-03-24 01:30
**Lane:** Data & Analytics

## Objective
Interactive financial modeling tool for METTLE subscription economics — coaches input team/pricing/cost parameters and get 12-month revenue projections, unit economics, scenario analysis, and tier upgrade impact modeling.

## Acceptance Criteria
- [x] 3-tier pricing model with distribution sliders
- [x] Unit economics (ARPU, LTV, LTV:CAC, payback, break-even)
- [x] 12-month projection with canvas chart + monthly table
- [x] Bear/Base/Bull scenario comparison
- [x] Churn sensitivity analysis
- [x] Tier upgrade path simulation with ARPU expansion
- [x] CSV + JSON export
- [x] Contextual insights on every panel

## A/B Context
Previous build: Team Strength Heat Map (2026-03-23) — performance analytics.
Variable changed: Shifted from athlete performance data to subscription financial modeling.
Expected improvement: Higher integration value — directly supports METTLE pricing decisions and investor pitch material.

## What Worked / What Didn't
Canvas chart rendering with dynamic DPR scaling works cleanly. The simulate12MoWithUpgrades function correctly models tier migration with proportional churn. Sensitivity chart x-axis relabeling required manual canvas overwrite after the generic chart draw — slightly hacky but functional. Single-file at 32KB keeps it portable. Insight generation based on thresholds (LTV:CAC >= 3x = healthy, < 1.5x = warning) gives immediate actionable context without requiring financial literacy.
