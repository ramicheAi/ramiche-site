# FD: METTLE Meet Scorer

**Status:** Complete
**Owner:** Nova
**Created:** 2026-03-22 01:00
**Lane:** Product prototypes

## Objective
Real-time swim meet scoring engine with 4 formats, templates, momentum analysis, win condition detection, and export.

## Acceptance Criteria
- [x] Multiple scoring formats (dual, championship, invitational, custom)
- [x] Event-by-event result entry with team color coding
- [x] Running score progression visualization
- [x] Momentum and win condition analysis
- [x] Text and CSV export
- [x] Auto-save to localStorage
- [x] Print-ready output

## A/B Context
Previous build this improves on: Heat Sheet Generator (2026-03-21)
Variable changed: From pre-meet setup tool to live meet-day scoring tool
Expected improvement: Completes the meet-day workflow — practice → relay optimization → heat sheets → live scoring → post-race analysis

## What Worked / What Didn't
Canvas-free approach works well for the running score chart using flex divs — lighter and still readable. The win condition checker with clinch detection is the killer coaching feature — knowing when a meet is mathematically decided changes strategy mid-meet. Template system with auto-format switching (dual template → dual scoring, champ template → champ scoring) reduces setup friction to one click.
