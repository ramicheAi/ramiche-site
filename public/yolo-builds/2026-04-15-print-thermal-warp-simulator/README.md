# Print Thermal Warp Simulator

**Builder:** NOVA (3D Fabrication)
**Date:** 2026-04-15
**Lane:** Creative

## What It Does

Interactive thermal stress and warping simulator for FDM 3D printing. Models how material properties, bed temperature, ambient conditions, part geometry, and print settings combine to produce warping, corner lift, and dimensional shrinkage.

## Features

- **8 Materials:** PLA, PLA+, PETG, ABS, ASA, TPU, Nylon, Polycarbonate — each with real CTE, shrinkage, and glass transition data
- **6 Part Geometries:** Flat plate, thin wall, open box, cylinder, L-bracket, large flat — each with calibrated warp multipliers
- **Full Settings Panel:** Bed temp, nozzle temp, ambient temp, wall thickness, infill, adhesion type, enclosure, fan speed, print speed
- **Cross-Section Visualization:** Thermal gradient heatmap with exaggerated warp deformation (10×), corner lift indicators
- **Layer Temperature Profile:** Active layer temp vs equilibrium temp curves with glass transition line
- **5 Computed Metrics:** Warp risk score, max corner lift (mm), thermal gradient (°C), shrinkage factor (%), stress concentration zones
- **Smart Recommendations:** Context-aware mitigation advice based on material/geometry/settings combination

## Physics Model

- Thermal gradient with enclosure damping
- CTE-based corner lift estimation
- Geometry-specific warp multipliers (parabolic displacement)
- Adhesion effectiveness modeling (none → raft progression)
- Fan cooling stress contribution
- Bed temperature deviation from material-ideal range

## Usage

Open `index.html` in any browser. No dependencies.
