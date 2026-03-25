# FD: METTLE // Dual Meet Strategy Planner

**Status:** Complete
**Owner:** Nova
**Created:** 2026-03-24 01:03
**Lane:** product

## Objective
Pre-meet tactical simulation — coaches enter two team rosters, simulate lineups, identify swing events, and get strategic recommendations to win the dual meet.

## Acceptance Criteria
- [x] 3 scoring formats + 3 relay scoring modes
- [x] 3 event templates (HS/College/Age Group)
- [x] Auto-lineup assignment respecting 3-event limit
- [x] Running score progression visualization
- [x] Swing event detection with recommendations
- [x] Win probability model
- [x] Strategic recommendation engine (5 recommendation types)
- [x] What-If alternative lineup generator
- [x] Relay impact analysis
- [x] Text + JSON export

## A/B Context
Previous build this improves on: Meet Scorer (2026-03-22)
Variable changed: Pre-meet planning vs live scoring
Expected improvement: Higher coach utility — strategy decisions happen before the meet, not during

## What Worked / What Didn't
Strategic recommendation engine with 5 distinct recommendation types (tight meet, deficit, relay vulnerability, depth advantage, concede & redirect) provides genuinely actionable coaching advice. Swing event detection using point-margin thresholds correctly identifies where lineup changes have maximum impact. What-If generator automatically finds beneficial swaps from bench into swing events. Sample data generator with strength-based time scaling creates realistic competitive scenarios for testing. The 5-tab layout keeps dense analytics navigable without overwhelming.
