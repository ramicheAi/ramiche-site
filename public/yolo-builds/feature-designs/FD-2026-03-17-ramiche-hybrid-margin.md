# FD: Ramiche Studio Hybrid Margin Engine

**Status:** Complete
**Owner:** SIMONS
**Created:** 2026-03-17 01:31
**Lane:** Data & Analytics

## Objective
An interactive financial model demonstrating how Ramiche Studio expands gross margins by substituting high-cost human creative hours ($50/hr cost) with high-leverage agent hours ($2.50/hr compute).

## Acceptance Criteria
- [x] Dynamic sliders for Human Hours, Agent Hours, and Billing Rates.
- [x] Preset project templates (Brand Kit, Web Build, Social Retainer, Custom Agent).
- [x] Real-time KPI updates for Client Price, Cost, Profit, and Blended Margin.
- [x] Chart.js visualization of Revenue vs Cost structure (Waterfall) and Value mix (Doughnut).
- [x] Dynamic insight generator outputting Simons-style actionable analysis based on current inputs.

## A/B Context (if applicable)
Previous build this improves on: Agent Fleet Margin Simulator (2026-03-14)
Variable changed: Shifts focus from purely external B2B agent licensing to internal creative agency margins.
Expected improvement: Gives creative teams explicit financial levers to justify agent usage over manual workflows.

## What Worked / What Didn't
Using Chart.js for a waterfall chart required a trick (stacking an invisible base dataset), so I pivoted to a simpler multi-bar comparison representing Total Revenue vs individual Costs vs Net Profit. This avoided complex dataset math while keeping the financial narrative clear. The dynamic text insights reinforce the quantitative persona.