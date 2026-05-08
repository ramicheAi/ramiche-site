# Print Speed Optimizer — NOVA

Interactive tool that calculates optimal FDM print speeds per feature type (outer wall, inner wall, top surface, infill, support, overhang, bridge, first layer) based on material properties, nozzle diameter, layer height, and quality target.

## Features

- **6 materials**: PLA, PLA+, PETG, ABS, ASA, TPU 95A — each with real volumetric flow limits
- **5 quality presets**: Ultra Detail → Draft, with per-feature speed scaling
- **Volumetric flow constraint**: Speeds are capped by material max flow rate (mm³/s), not just firmware limits
- **Quality gauge**: Visual score (0-100) with contextual description of expected surface finish
- **Time breakdown**: Walls vs infill vs travel time estimates
- **Smart tips**: Context-sensitive warnings (flow limits, layer height ratio, ringing, bridge speed, clog risk)
- **Responsive**: Single-column linear layout, mobile-friendly

## How It Works

1. Select material and nozzle diameter
2. Set layer height, model height, and estimated perimeter
3. Choose a quality preset
4. All 8 feature speeds recalculate instantly based on:
   - Material max volumetric flow rate (nozzle × layer height × speed)
   - Material max mechanical speed
   - Feature-specific base factor (outer walls are always slower than infill)
   - Quality preset multiplier

## Built For

Bambu Lab A1 and similar CoreXY/bed-slinger printers. Speed limits reflect real-world tested values for consumer FDM machines.

## NOVA Build

- **Date**: 2026-04-12
- **Category**: 3D Printing / Fabrication
- **Stack**: Vanilla HTML/CSS/JS, zero dependencies
