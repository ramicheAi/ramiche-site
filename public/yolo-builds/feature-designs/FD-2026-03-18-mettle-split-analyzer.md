# FD: METTLE Split Analyzer

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-18 12:36
**Lane:** Product prototypes

## Objective
Interactive coaching tool that analyzes swim race split times with pacing curves, strategy detection, and actionable recommendations.

## Acceptance Criteria
- [x] Supports 10+ event types with correct split counts
- [x] Pacing curve rendered on canvas (no external deps)
- [x] Strategy detection (negative/positive/even/fly-and-die)
- [x] Coaching recommendations per strategy
- [x] Split table with cumulative times and diff-vs-average
- [x] METTLE brand applied (purple/scarlet/gold/blue, no dark mode)
- [x] Paste input and manual entry modes
- [x] Demo presets for quick testing

## A/B Context
Previous build this improves on: FORGE — Material Science Lab (2026-03-17)
Variable changed: Domain shift from material science reference tool → race analysis coaching tool
Expected improvement: Higher evaluation score (METTLE-focused builds score 98-105 vs fabrication tools 64-81)

## What Worked / What Didn't
Canvas-rendered chart with no dependencies kept the file self-contained at 23KB. Strategy detection logic is straightforward (half differential thresholds). The recommendation text is the highest-value feature — coaches need actionable next steps, not just data. IM events need per-stroke analysis (fly vs back vs breast vs free pacing is fundamentally different) which is a clear next iteration.
