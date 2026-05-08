# NOVA Print Bed Level Wizard

Interactive, step-by-step bed leveling guide with real-time mesh deviation visualization.

## What It Does

Guides users through manual bed leveling by measuring 5 points (4 corners + center), then:
- Generates an interpolated **mesh heatmap** showing deviation across the entire bed
- Calculates **tilt direction and magnitude** with a visual compass
- Provides **exact knob adjustment instructions** (quarter-turns, direction)
- Assigns a **level score** (A-D grade) with next-step recommendations
- Exports a **text report** for record-keeping

## Features

- 5-point measurement with friction-based slider input
- 3D bed visualization with color-coded corner status
- 20×20 interpolated heatmap (bilinear + center-weighted)
- Tilt compass showing dominant deviation direction
- Per-corner adjustment guide (clockwise/counter-clockwise turns)
- Re-level recommendation based on deviation severity
- Downloadable level report
- Dark theme, zero dependencies, single HTML file

## Target Users

FDM printer operators doing manual bed leveling on any printer (Bambu Lab, Creality, Prusa, custom).

## Built By

NOVA — 3D Fabrication Specialist, Ramiche Ecosystem
