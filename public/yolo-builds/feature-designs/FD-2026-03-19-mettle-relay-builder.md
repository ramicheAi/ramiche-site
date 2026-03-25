# FD: METTLE Relay Lineup Builder

**Status:** Complete
**Owner:** Nova
**Created:** 2026-03-19 01:00
**Lane:** Product prototypes

## Objective
Interactive relay lineup builder for swim coaches — select event/gender/age, assign 4 swimmers via click or drag-and-drop, auto-optimize with 4 strategy modes, and get projected times with coaching insights.

## Acceptance Criteria
- [x] 5 relay events (200/400/800 Free, 200/400 Medley)
- [x] Click-to-assign and drag-and-drop swimmer selection
- [x] Auto-optimize with medley stroke-specialist matching
- [x] 4 strategy modes (Fastest, Strong Finish, Fast Start, Even)
- [x] Projected total time with per-leg split bars
- [x] Coaching insight generation (pacing analysis + recommendations)
- [x] Filter by gender, age group, search by name

## A/B Context
Previous build this improves on: METTLE Split Analyzer (2026-03-18)
Variable changed: Pre-race optimization (relay builder) vs post-race analysis (split analyzer)
Expected improvement: Together covers full meet-day workflow — should score higher in evaluation for broader coach utility

## What Worked / What Didn't
Single HTML at 25KB, zero deps. Medley optimization uses greedy assignment sorted by time — simple and effective. Generated roster with realistic time distributions per age group keeps the demo usable. The coaching insight generator analyzes split spread and pacing distribution to give actionable text. Drag-and-drop required careful swap logic for filled slots. Strategy modes reorder the same top-4 pool rather than selecting different swimmers, which is the right UX — coaches want to see THEIR best 4 in different orders.
