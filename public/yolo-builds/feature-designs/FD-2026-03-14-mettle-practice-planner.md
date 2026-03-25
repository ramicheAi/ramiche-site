# FD: METTLE Practice Planner

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-14 01:00
**Lane:** Product prototypes

## Objective
Interactive swim practice set builder for coaches — structured workout construction with energy zone tracking, volume calculation, drag-and-drop reorder, quick templates, and exportable practice cards.

## Acceptance Criteria
- [x] Coaches can add set groups (Warm-Up, Main Set, Kick, Pull, Drill, Sprint, Cool-Down, Test Set)
- [x] Each set item has reps, distance, stroke, interval, energy zone, and notes
- [x] Real-time volume calculator (total yards/meters, est. time, set count, interval count)
- [x] Energy zone distribution chart (7 zones: REC, EN1-EN3, SP1-SP3)
- [x] 8 quick-add templates for fast practice construction
- [x] Drag-and-drop group reordering
- [x] Text export with zone breakdown, clipboard copy, print support
- [x] LocalStorage save/load for practice persistence
- [x] Demo mode with realistic 4,200-yard distance/threshold workout
- [x] Pool course support (SCY, SCM, LCM)

## A/B Context
Previous build this improves on: METTLE Meet Day Command Center (2026-03-10)
Variable changed: Different METTLE persona — daily coaching tool vs. meet day tool
Expected improvement: Daily use frequency (practice planning is 5x/week vs. meet day ~2x/month)

## What Worked / What Didn't
The template system worked well — 8 pre-built templates let coaches build a full practice in under a minute. Energy zone breakdown gives coaches instant visibility into workout balance. The estimated time calculation uses zone-based pace multipliers for realistic estimates. Grid-based set items with inline editing keeps the workflow fast. Key insight: this is the "coach uses it every single day" tool that makes METTLE indispensable — meet day and parent portal are occasional, but practice planning is daily.
