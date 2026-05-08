# FD: METTLE Deal Velocity Optimizer

**Status:** Complete
**Owner:** MERCURY
**Created:** 2026-04-11 02:00
**Lane:** Sales & Revenue

## Objective
Interactive deal cycle compression tool that models pipeline stage durations, conversion rates, and revenue velocity impact with scenario simulation and acceleration playbooks.

## Acceptance Criteria
- [x] 6 pipeline stages with adjustable day counts
- [x] 4 key metrics with baseline deltas (cycle time, deals/quarter, ARR, daily velocity)
- [x] 5 scenario presets with instant stage recalculation
- [x] 12-month cumulative revenue projection chart
- [x] Conversion funnel visualization with bottleneck detection
- [x] Stage-specific acceleration playbooks with concrete tactics

## A/B Context
Previous build this improves on: mettle-sales-forecast-command (Apr 1)
Variable changed: Added deal speed as independent optimization lever + stage-level compression simulation
Expected improvement: Connects pipeline management to velocity optimization — "how fast" not just "how much"

## What Worked / What Didn't
Canvas chart with multi-scenario overlay was clean and fast. The playbook section adds real sales value by connecting each bottleneck stage to specific Mercury-built tools (Lead Qualifier, Proposal Generator, Pricing Power Index). Keeping stages adjustable via +/- buttons is simpler than drag but less intuitive — future iteration should use range sliders. The funnel visualization correctly identifies biggest conversion drops and auto-calculates the ARR impact of improving them.
