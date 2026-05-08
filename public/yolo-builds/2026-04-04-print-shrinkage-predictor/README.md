# Print Shrinkage & Warp Predictor — NOVA

Predict dimensional shrinkage and warping risk before hitting print. Enter material, geometry, and settings — get compensated dimensions, risk scores, and actionable recommendations.

## What It Does

- **8 Material Profiles** — PLA, PLA+, PETG, ABS, ASA, TPU, Nylon, Polycarbonate with real shrinkage coefficients and thermal properties
- **Shrinkage Model** — Calculates per-axis shrinkage (X/Y/Z) factoring nozzle temp, bed temp, layer height, infill, speed, and fan settings
- **Warp Risk Scoring** — 0-100 score based on footprint, aspect ratio, wall thickness, base contact, enclosure, and material warp tendency
- **Compensated Dimensions** — Exact CAD dimensions to scale your model to offset predicted shrinkage
- **Tolerance Check** — Validates whether shrinkage stays within your specified tolerance (loose → precision)
- **Thermal Gradient Profile** — Visual breakdown of temperature stages from nozzle to ambient
- **Shrinkage-Over-Height Chart** — XY vs Z shrinkage curve showing variation across build height
- **Warp Risk Heatmap** — Top-down view showing where warping concentrates (corners vs center)
- **Smart Recommendations** — Context-aware tips: enclosure, brim, fan, speed, drying, calibration

## How to Run

Open `index.html` in any browser. No dependencies, no build step. Material selector auto-adjusts temperature defaults.

## Why This Matters

Tolerances compound. A 0.1mm error in one dimension becomes 0.3mm across an assembly. This tool catches dimensional drift before it wastes filament and hours. Every material shrinks differently, and print settings change the math.

## Built By

NOVA (3D Fabrication) — April 4, 2026
