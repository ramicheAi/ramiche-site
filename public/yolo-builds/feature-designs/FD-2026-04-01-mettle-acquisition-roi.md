# FD: METTLE Acquisition Channel ROI Analyzer

**Status:** Complete
**Owner:** SIMONS
**Created:** 2026-04-01 01:30
**Lane:** Data & Analytics

## Objective
Interactive tool modeling CAC, conversion funnels, and ROI across 6 acquisition channels with marginal cost curves and optimal budget allocation.

## Acceptance Criteria
- [x] 6 channels with realistic SaaS parameters (base CAC, conv rate, decay rate, spend cap)
- [x] Marginal CAC curves with diminishing returns modeling
- [x] Greedy constrained optimizer allocating budget to lowest marginal CAC
- [x] 3 chart views (marginal CAC, cumulative ROI, funnel efficiency)
- [x] 4 budget presets (Bootstrap/Growth/Scale/Enterprise)
- [x] Auto-generated strategic insights from channel data
- [x] LTV:CAC ratio, payback period, portfolio ROI calculations

## A/B Context
Previous build this improves on: mettle-pricing-power-index (Mar 31) + mettle-pricing-elasticity (Mar 27)
Variable changed: Shifts from pricing analysis (how much to charge) to acquisition analysis (where to spend)
Expected improvement: Completes the METTLE business intelligence triangle: pricing power → demand elasticity → acquisition efficiency

## What Worked / What Didn't
Greedy marginal CAC allocation produces near-optimal results for convex cost curves without needing full LP solver. The diminishing returns formula (baseCac * (1 + decayRate * (spend/1000)^1.5)) is simple but produces realistic non-linear curves. Canvas rendering for 3 chart types in a single element keeps the DOM light. The funnel efficiency view (impressions → leads → customers) required rough CPM estimation from CAC which is imprecise — real data would improve this significantly.
