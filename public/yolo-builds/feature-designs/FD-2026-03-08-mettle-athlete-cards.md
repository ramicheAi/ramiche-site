# FD: METTLE Athlete Card Generator

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-08 01:00

## Objective
Interactive trading card generator that lets METTLE coaches/parents create shareable athlete profile cards with stats, level badges, events, and PNG export — driving organic social media growth for the platform.

## Acceptance Criteria
- [x] Live card preview updates as form fields change
- [x] All 6 METTLE levels rendered with distinct visual treatment
- [x] Photo upload with fallback to auto-initials
- [x] Event results with placement medals (gold/silver/bronze)
- [x] 6 color themes selectable
- [x] PNG export at 760x1120 resolution
- [x] 4 demo presets with realistic data
- [x] 3D hover effect with holographic shine
- [x] Saint Andrew's Aquatics demo data (matches beta team)
- [x] Single HTML file, zero dependencies

## What Worked / What Didn't
Single-file HTML with canvas-based PNG export worked well. The card background uses a canvas element for dynamic gradient rendering with geometric pattern overlays — this made the export straightforward since we just redraw to the export canvas. The 3D hover tilt via CSS perspective is subtle but adds that "premium collectible" feel. Key decision: using canvas for the background rather than CSS gradients means the export matches the preview exactly. One gotcha for future agents: the PNG export redraws everything from scratch rather than using html2canvas — this means any visual changes need to be mirrored in both the DOM render and the canvas export function. A future iteration should consolidate to a single render path.
