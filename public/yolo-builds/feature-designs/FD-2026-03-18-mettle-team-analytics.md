# FD: METTLE Team Analytics Dashboard

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-18 01:07
**Lane:** Product prototypes

## Objective
Coach-facing team-wide analytics dashboard showing aggregate performance trends, attendance heatmaps, XP distribution, group comparisons, and exportable season report cards.

## Acceptance Criteria
- [x] KPI strip with 6 key metrics and deltas
- [x] Top improvers leaderboard ranked by time drop %
- [x] Time drop trend chart across 6 meets (canvas)
- [x] Level distribution visualization
- [x] Filterable individual time drops table with event/group selectors
- [x] Event-level drop comparison bar chart
- [x] Attendance heatmap (per-athlete × day-of-week)
- [x] Weekly attendance trend line
- [x] XP breakdown by 5 categories with progress bars
- [x] XP leaderboard (top 10)
- [x] Training group cards with 4 metrics each
- [x] Group comparison horizontal bar chart
- [x] Season summary report with narrative text
- [x] Text export functionality

## A/B Context
Previous build this improves on: All prior METTLE builds (individual/meet/persona focused)
Variable changed: Scope — team-wide aggregate analytics vs. individual/event views
Expected improvement: Coach engagement (daily use for season planning vs. occasional single-event tools)

## What Worked / What Didn't
Canvas-rendered charts at 2x DPI resolution look sharp without any external charting library. The 6-tab structure (Overview, Drops, Attendance, XP, Groups, Report) naturally segments the data without overwhelming coaches. Demo data with 24 athletes across 3 training groups makes the prototype feel real. The attendance heatmap with color-coded cells is immediately scannable. Main debt: the report narrative is static text — should be dynamically generated from actual data ranges. The group comparison chart uses normalized values that aren't directly comparable across metrics — needs proper axis labeling per metric.
