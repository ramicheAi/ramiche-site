# METTLE Team Analytics Dashboard

Coach-facing team-wide analytics dashboard for METTLE — shows aggregate performance trends, attendance patterns, XP distribution, and exportable team report cards.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- **KPI Strip:** 6 key metrics with month-over-month deltas
- **Top Improvers Leaderboard:** Ranked by average time drop percentage across all events
- **Time Drop Trend Chart:** 6-meet season trend with bar + trendline (canvas-rendered)
- **Level Distribution:** Visual breakdown of all 6 METTLE levels across the team
- **Time Drops Tab:** Filterable by event and group, drop badges (good/great/elite), event comparison chart
- **Attendance Heatmap:** Per-athlete weekly heatmap + 8-week trend line with area fill
- **XP & Levels Tab:** Category breakdown (Attendance/Drops/Meets/Goals/Spirit) + XP leaderboard
- **Groups Tab:** 3 training group cards with 4 metrics each + group comparison horizontal bar chart
- **Team Report Tab:** Season summary stats, narrative analysis, and text export

## What's Missing / Next Steps

- Wire to Firestore for real athlete data (currently seeded with 24 demo athletes)
- PDF export (currently text-only)
- Date range picker for custom analysis windows
- Comparative season-over-season analysis
- Individual athlete drill-down from any chart

## A/B Context

Fills a gap in the METTLE YOLO portfolio: all previous builds target individual athletes, single meets, or specific personas. This is the first **team-wide analytics** view — the bird's-eye perspective coaches need for season planning, parent nights, and board presentations.
