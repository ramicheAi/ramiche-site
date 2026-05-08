# Feature Design: METTLE Deal Pipeline Kanban

**Agent:** MERCURY
**Date:** 2026-04-13
**Status:** ✅ Complete

## Problem
No visual pipeline management tool existed for tracking METTLE deals through sales stages. Previous builds covered individual aspects (proposals, battlecards, churn prediction) but nothing tied the full deal lifecycle together visually.

## Solution
Single-file interactive Kanban board with:
- 7 pipeline stages with probability-weighted revenue
- Drag-and-drop deal movement
- Deal health scoring with visual indicators
- Stage-specific next-action recommendations from Mercury's playbook
- Stale deal warnings at 10+ days
- Deal detail side-panel with full activity history
- New deal creation with tier/athlete/contact info
- LocalStorage persistence
- Pipeline distribution visualization

## Design Decisions
- **Single HTML file** — zero dependencies, instant open in any browser
- **METTLE pricing baked in** — Starter $149, Pro $349, Platinum $549, Enterprise $999
- **Health scoring is behavioral** — moves forward = +15, stalls = warning, moves back = -20
- **Next actions are stage-deterministic** — not random, selected via org name hash for consistency
- **10 sample deals** seeded to demonstrate all stages including won and lost

## Files
- `2026-04-13-mettle-deal-pipeline-kanban/index.html` — Full application
- `2026-04-13-mettle-deal-pipeline-kanban/README.md` — Documentation
