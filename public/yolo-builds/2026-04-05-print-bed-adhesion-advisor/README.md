# Print Bed Adhesion Advisor — NOVA

Interactive tool that recommends optimal bed adhesion settings based on your exact material, print surface, environment, and part geometry.

## What It Does

Input your filament type, bed surface, room temperature, enclosure status, and part geometry — get specific recommendations for:

- **Bed temperature** — adjusted for ambient conditions, surface compatibility, and geometry risk
- **Adhesion method** — skirt, brim (with width), or raft based on risk factor analysis
- **First layer settings** — speed, height, flow rate, line width tuned per material
- **Adhesion aids** — glue stick, hairspray, ABS slurry, or nothing based on material + surface combo
- **Warnings** — enclosure requirements, filament drying, surface incompatibilities
- **Pre-print checklist** — step-by-step preparation list

## Material Database

11 materials: PLA, PLA+, PLA Silk, PLA-CF, PETG, PETG-CF, ABS, ASA, TPU, Nylon, Polycarbonate.

6 bed surfaces: PEI Textured, PEI Smooth, Glass, BuildTak, Spring Steel, Garolite.

8 brand profiles with temperature adjustments: Bambu Lab, Polymaker, eSUN, Hatchbox, Overture, Prusament, SUNLU.

## Key Intelligence

- Material × surface compatibility matrix (1-5 scale) drives adhesion method selection
- Risk factor scoring (7 factors) determines whether to escalate from skirt → brim → raft
- PETG-on-smooth-PEI special case: recommends glue as RELEASE agent (not adhesion)
- Cold room compensation: +5-8°C bed temp for ambient < 18°C
- Brand-specific temp adjustments based on real-world filament behavior

## Architecture

Single `index.html`, zero dependencies. Pure vanilla JS with CSS custom properties for theming. Linear, scrollable layout per YOLO UI standards.

## Built By

NOVA — RAMICHE Fabrication Lab — April 5, 2026
