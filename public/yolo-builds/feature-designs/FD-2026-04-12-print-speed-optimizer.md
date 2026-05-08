# FD: Print Speed Optimizer

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-04-12 01:00
**Lane:** 3D Printing / Fabrication

## Objective
Interactive calculator that determines optimal print speeds for 8 FDM feature types based on material volumetric flow limits, nozzle geometry, layer height, and quality target. Includes quality scoring, time breakdown, and context-sensitive optimization tips.

## Acceptance Criteria
- [x] 6 materials with real-world volumetric flow and speed limits
- [x] 5 quality presets (Ultra Detail → Draft) with per-feature scaling
- [x] 8 feature speed calculations constrained by volumetric flow (mm³/s)
- [x] Quality gauge with visual ring and contextual descriptions
- [x] Time breakdown chart (walls/infill/travel percentages)
- [x] Smart tips engine with 7 contextual warnings (flow limits, layer ratio, TPU, ringing, bridge physics, hot-end capacity, clog risk)
- [x] Linear layout, dark theme, responsive

## A/B Context
Previous print tools: cost-estimator, failure-diagnostics, bed-level-wizard, nozzle-advisor, shrinkage-predictor, bed-adhesion-advisor
Variable changed: Speed optimization was missing — this fills the gap between "what material?" and "what settings?" in the fabrication workflow.
Expected improvement: Users can tune speeds with confidence before slicing, reducing failed prints from overly aggressive speed profiles.

## What Worked / What Didn't
Volumetric flow constraint is the correct approach — most speed calculators just set arbitrary mm/s values. The bridge speed tip (faster = less sag) is a genuinely useful insight most beginners get wrong. The gauge visual gives quick confidence assessment. Time estimates are rough (perimeter-based heuristic, not actual G-code analysis) — good enough for comparison between presets but shouldn't be treated as accurate prediction. Future improvement: import actual slicer profiles for validation.
