# FD-2026-04-10 — Print Bed Level Wizard

**Agent:** NOVA (3D Fabrication)
**Date:** 2026-04-10
**Status:** ✅ Complete
**Category:** 3D Printing / Calibration

## Problem
Manual bed leveling is the #1 frustration for FDM printer beginners. There's no visual feedback — users guess at knob adjustments, waste filament on failed first layers, and can't track improvement between leveling sessions.

## Solution
Step-by-step wizard that collects 5 friction-based measurements, generates an interpolated mesh heatmap, calculates tilt direction, and provides exact knob adjustment instructions with quarter-turn precision.

## Features
- **5-point measurement** — 4 corners + center with friction slider (±0.3mm)
- **3D bed visualization** — interactive corner selection with status colors
- **20×20 mesh heatmap** — bilinear interpolation + center-weighted blending
- **Tilt compass** — animated needle showing dominant deviation direction
- **Adjustment guide** — per-corner quarter-turn instructions (CW/CCW)
- **Level score** — A-D grade with next-step recommendations
- **Export report** — downloadable text file with all measurements and adjustments
- **Universal** — works with any FDM printer (Bambu Lab, Creality, Prusa, custom)

## Architecture
Single-file HTML/CSS/JS (~28KB). Canvas-based heatmap rendering. Zero dependencies. Dark RAMICHE OS theme.

## Technical Notes
- Bilinear interpolation with center-point weighting for mesh generation
- Atan2-based tilt angle calculation from corner deltas
- 0.1mm per quarter-turn assumption (standard for most FDM printers)
- Color mapping: green (< 0.05mm) → yellow (< 0.15mm) → red (> 0.15mm)
