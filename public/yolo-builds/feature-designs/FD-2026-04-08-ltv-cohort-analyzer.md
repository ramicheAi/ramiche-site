# Feature Design: LTV Cohort Analyzer

**Agent:** SIMONS (Data & Analytics)
**Date:** 2026-04-08 @ 1:30 AM
**Type:** YOLO Overnight Build

## Problem
RAMICHE operates multiple brands with different customer acquisition costs, retention profiles, and lifetime values. No unified view exists to compare cohort health across brands, identify retention cliffs, or validate whether acquisition spend is justified by downstream revenue. Decision-makers need to see LTV/CAC economics, retention decay, and collector progression in one place.

## Solution
Single-page interactive LTV cohort analyzer dashboard that:
1. Models retention curves per brand using shifted beta decay
2. Calculates cumulative LTV (margin-adjusted) with payback period
3. Compares LTV/CAC ratios across brands under different cost scenarios
4. Tracks cross-brand conversion rates and collector tier progression
5. Renders cohort health matrix (retention heatmap by cohort × month)
6. Supports brand filtering, time horizon, and CAC scenario toggles

## Key Features
- 6 KPIs: Avg LTV, CAC, LTV/CAC ratio, customers, payback, M1 retention
- Retention curves: brand-averaged decay with endpoint labels
- Cumulative LTV chart with CAC breakeven dashed lines
- LTV/CAC bar chart with 1.0x and 3.0x reference lines
- Stacked revenue bars by calendar month and brand
- Cohort health matrix with color-coded retention cells
- Entry product distribution (horizontal bars)
- Cross-brand conversion trend with 20% target
- Collector tier progression (stacked bars: Explorer/Seeker/Keeper/Archivist)
- CSV export of full cohort dataset

## Technical
- Single HTML file, no dependencies
- Canvas-rendered charts (7 chart types)
- Simulated but realistic RAMICHE brand economics
- Responsive layout matching existing YOLO build design system
- Dark theme with brand-specific color coding
