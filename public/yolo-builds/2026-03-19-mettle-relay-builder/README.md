# METTLE // Relay Lineup Builder

Interactive relay team builder for swim coaches. Select event type, gender, and age group, then build your 4-swimmer relay lineup with drag-and-drop or click-to-assign.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- **5 relay events:** 200 Free, 200 Medley, 400 Free, 400 Medley, 800 Free
- **Auto-Optimize:** One-click best lineup based on roster times
- **4 Strategy Modes:** Fastest Total, Strong Finish, Fast Start, Even Splits
- **Drag & Drop:** Reorder swimmers across legs with visual feedback
- **Medley Intelligence:** Greedy optimization assigns best stroke-specialist per leg
- **Projected Time:** Live total with split visualization bars
- **Coaching Insights:** Automated pacing analysis (front-loaded, back-loaded, balanced) with actionable recommendations
- **Filter & Search:** By gender, age group, swimmer name

## What's Missing / Next Steps

- Import real roster data from METTLE Firestore (athlete seed times)
- Save/load multiple lineup configurations per meet
- Export relay cards as PDF for deck marshals
- Head-to-head comparison mode (two lineups side by side)
- Relay exchange time estimation (+0.3-0.7s per exchange)

## A/B Context

Builds on METTLE Split Analyzer (Mar 18) — same coaching tools lane. This adds pre-race optimization vs post-race analysis. Together they cover the full meet-day workflow.
