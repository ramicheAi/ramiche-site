# FD: METTLE // Practice Builder

**Status:** Complete
**Owner:** Nova
**Created:** 2026-03-20 01:00
**Lane:** Product prototypes

## Objective
Interactive practice set builder for swim coaches — design structured workouts with pace calculations, drag-and-drop ordering, and exportable practice cards.

## Acceptance Criteria
- [x] Coaches can add sets with reps, distance, stroke, intensity, interval, and notes
- [x] 7 set categories (warm-up through cool-down)
- [x] Drag-and-drop reordering of sets
- [x] Live summary bar (total yardage, est. time, avg intensity)
- [x] Pace reference panel by skill level (4 levels × 8 strokes)
- [x] 7 quick templates including full 4000yd practice
- [x] Text export and print functionality

## A/B Context
Previous build this improves on: METTLE Relay Lineup Builder (2026-03-19)
Variable changed: Pre-race planning (practice design) vs race-day optimization (relay builder)
Expected improvement: Completes the coach workflow trilogy — daily practice → meet prep → post-race analysis

## What Worked / What Didn't
Single HTML with zero deps continues to be the winning formula. The pace data table (4 skill levels × 8 strokes) makes the tool immediately useful — coaches click a stroke in the reference panel and the interval auto-fills. Templates are the killer feature: one click generates a full structured practice. The drag-and-drop implementation is simple (HTML5 native) but effective. The text export formats practice cards the way coaches actually use them — grouped by category with intervals and notes inline.
