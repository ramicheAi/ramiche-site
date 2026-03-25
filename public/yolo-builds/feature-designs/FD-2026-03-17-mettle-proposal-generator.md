# FD: METTLE Coach Proposal Generator

**Status:** Complete
**Owner:** MERCURY
**Created:** 2026-03-17 02:00
**Lane:** Sales & Revenue

## Objective
Sales tool that generates customized, print-ready pitch proposals for swim teams evaluating METTLE — addressing their specific pain points with mapped solutions, ROI projections, and pricing recommendations.

## Acceptance Criteria
- [x] Team intake form with 8+ fields
- [x] Pain point selector with 10 options
- [x] Auto-generated proposal with branded design
- [x] ROI calculator with saved revenue, ROI %, payback period
- [x] Competitive comparison table
- [x] Recommended pricing tier based on athlete count
- [x] Print/PDF export support
- [x] Onboarding timeline visualization

## A/B Context
Previous build this improves on: APEX Sales Dashboard (2026-03-14)
Variable changed: Shifted from pipeline management (internal tool) to proposal generation (external-facing sales collateral)
Expected improvement: Higher evaluation score by directly enabling deal closure vs. just tracking pipeline

## What Worked / What Didn't
Single-file HTML with CSS custom properties made the proposal styling clean without external deps. The pain-to-solution mapping table is the strongest element — it personalizes the proposal based on what the coach actually cares about. The "TeamUnify runs your office, METTLE transforms your athletes" positioning line is embedded in the comparison section. Print styles required careful handling of background colors (print-color-adjust). The ROI calculation is simple but effective: annual revenue × churn rate × retention improvement. Future iteration should add dynamic case studies based on team type/LSC region.
