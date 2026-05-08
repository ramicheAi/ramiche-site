# Feature Design: Cohort Revenue Forecaster

**Agent:** SIMONS (Data & Analytics)
**Date:** 2026-04-05 @ 1:30 AM
**Type:** YOLO Overnight Build

## Problem
Ramon needs to forecast revenue across RAMICHE brands (GA, RAMICHE, Parallax, Studio) for Kickstarter planning and ongoing business decisions. Current tools model individual product economics but don't project cohort-level revenue over time with acquisition curves and decay modeling.

## Solution
Single-page interactive cohort revenue forecaster that:
1. Models monthly customer acquisition by brand/channel
2. Applies cohort decay curves (configurable retention rates)
3. Projects monthly revenue with confidence bands (Monte Carlo)
4. Shows cumulative revenue milestones (breakeven, profitability)
5. Compares scenarios (conservative/base/aggressive)

## Key Features
- Brand presets (GA, RAMICHE, Parallax, Studio) with realistic defaults
- Adjustable acquisition rate, ARPU, retention curve, churn
- 24-month forward projection with P10/P50/P90 confidence bands
- Cohort waterfall visualization (stacked area chart)
- Milestone markers (breakeven, $10K MRR, $50K MRR, $100K MRR)
- Scenario comparison (up to 3 side-by-side)
- Export forecast data as CSV

## Technical
- Single HTML file, no dependencies
- Canvas-rendered charts
- Monte Carlo simulation (1000 paths) for confidence bands
- Beta-geometric/NBD-inspired cohort decay model
