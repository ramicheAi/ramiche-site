# FD: METTLE // Team Strength Heat Map

**Status:** Complete
**Owner:** Simons
**Created:** 2026-03-23 01:30
**Lane:** Data & analytics

## Objective
Visual matrix dashboard showing team depth across all 12 swim events with color-coded performance tiers, dual meet scoring potential, gap analysis, and prioritized recruiting recommendations.

## Acceptance Criteria
- [x] Heat map matrix: swimmers × events with AA/A/BB/B/Novice color coding
- [x] Dual meet scoring potential calculator (6-4-2 format)
- [x] Event desert detection (0 swimmers in an event)
- [x] Gap analysis with severity levels (critical/warning/info)
- [x] Recruiting recommendations with priority ranking and point impact
- [x] Full depth chart per event with ranked swimmers
- [x] Sample team loader (14 swimmers) for demo
- [x] localStorage persistence

## A/B Context
Previous build this improves on: IM Conversion Matrix (2026-03-21)
Variable changed: Scope shift from individual athlete stroke analysis to team-wide roster depth analysis
Expected improvement: Higher utility for coaches managing meet lineups — team-level view vs individual-level

## What Worked / What Didn't
Benchmark-tiered scoring (AA/A/BB/B scale) is immediately intuitive for swim coaches — maps directly to USA Swimming motivational time standards they already know. The gap analysis engine identifying single-swimmer dependencies and >10% intra-event gaps provides actionable intelligence coaches can't easily see in spreadsheets. Recruiting recommendations with specific time cutoffs and point impact projections make the tool directly useful for team growth strategy. At 32KB single HTML, the tool is dense but stays responsive. Cross-training suggestions (adjacent stroke recommendations) are a simple heuristic but surprisingly useful.
