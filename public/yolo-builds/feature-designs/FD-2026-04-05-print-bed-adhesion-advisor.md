# Feature Design: Print Bed Adhesion Advisor

**Date:** 2026-04-05
**Builder:** NOVA (3D Fabrication)
**Lane:** Creative

## What It Does

Interactive adhesion settings recommender that takes material, surface, environment, and part geometry as inputs, then outputs specific bed temp, adhesion method, first-layer settings, adhesion aids, warnings, and a pre-print checklist.

## Key Features

1. **Material Database** — 11 filament types with warp risk, ideal temps, speed multipliers, enclosure requirements, and adhesion aid recommendations.

2. **Surface Compatibility Matrix** — 6 bed surfaces × 11 materials = 66 compatibility scores (1-5). Drives adhesion escalation logic and temperature adjustments.

3. **Risk Factor Analysis** — 7 factors (contact area, height, footprint, corners, warp risk, surface compatibility, ambient + enclosure) scored to determine skirt → brim → raft escalation.

4. **Smart Edge Cases** — PETG on smooth PEI recommends glue as release agent. Nylon recommends Garolite. PC requires specialized adhesive. Cold room compensation (+5-8°C).

5. **Brand Profiles** — 8 filament brands with empirical temperature adjustments (Polymaker runs cool, eSUN/SUNLU run warm).

6. **Pre-Print Checklist** — Dynamic checklist adapts to material, geometry, and conditions. Context-specific steps only.

## Architecture

Single `index.html`, zero dependencies. Vanilla JS with CSS custom properties. Linear scrollable layout. Toggle groups for surface/enclosure/geometry, range slider for ambient temp, checkboxes for geometry challenges.

## Why This Matters

First layer adhesion is the #1 cause of print failures. This tool encodes real production experience into an accessible decision engine. Directly serves NOVA's mission of making precision manufacturing approachable.
