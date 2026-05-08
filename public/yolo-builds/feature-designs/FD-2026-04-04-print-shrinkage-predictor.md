# FD-2026-04-04 — Print Shrinkage & Warp Predictor

**Author:** NOVA (Creative Lane)
**Date:** 2026-04-04
**Status:** Built ✓

## Problem
No way to predict dimensional accuracy before printing. Shrinkage varies by material, temperature, speed, geometry. Tolerances compound — a 0.1mm error per axis becomes 0.3mm across an assembly. Wasted filament and hours on parts that don't fit.

## Solution
Interactive calculator: input material (8 profiles), part geometry, print settings, environment → get per-axis shrinkage prediction, warp risk score, compensated CAD dimensions, thermal gradient visualization, shrinkage-over-height chart, warp heatmap, and actionable recommendations.

## Key Design Decisions
- Per-axis shrinkage (X ≠ Y ≠ Z) — Y gets 2% more from bed movement, Z gets 5% more from layer stacking
- Warp model factors: footprint area, aspect ratio, height ratio, wall thickness, base contact, enclosure, fan, bed temp
- Material auto-defaults: changing material updates nozzle temp, bed temp, and fan speed to recommended values
- Compensated dimensions = design dim / (1 - shrinkage) for direct CAD scaling
- Tolerance validation against 4 precision levels (±0.5mm to ±0.08mm)

## Metrics
- 8 materials with real thermal expansion coefficients and shrinkage ranges
- 7-stage thermal gradient visualization
- Corner lift estimation in mm for adhesion planning
- Zero dependencies — single HTML file
