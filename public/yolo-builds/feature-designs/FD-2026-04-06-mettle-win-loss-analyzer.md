# Feature Design: METTLE Win/Loss Post-Mortem Analyzer

**Agent:** MERCURY (Sales & Revenue)
**Date:** 2026-04-06
**Priority:** High — closes the feedback loop on all other sales tools

## Problem

We have tools for every stage of the pipeline EXCEPT learning from outcomes. No systematic way to track why deals close or die, identify patterns across wins/losses, or feed insights back into the sales process. Without this, we're flying blind — repeating mistakes and not doubling down on what works.

## Solution

Interactive deal post-mortem tool. Log won and lost deals with structured data, then analyze patterns across the portfolio.

## Features

### 1. Deal Logger
- Team name, size, tier, channel, decision-maker role
- Outcome: Won / Lost / Stalled
- Primary reason (structured): Price, Timing, Competitor, No Champion, Budget Freeze, Wrong Tier, Feature Gap, Status Quo, Ghosted
- Secondary factors (multi-select)
- Deal value (ACV), sales cycle length (days)
- Competitive context (who else they evaluated)
- Notes (freeform)

### 2. Win/Loss Dashboard
- Win rate by tier (Starter/Pro/Program/Enterprise)
- Win rate by team size bucket (1-50, 51-100, 101-200, 200+)
- Win rate by loss reason (which objections kill deals most)
- Average deal cycle by outcome
- Revenue won vs lost (opportunity cost visibility)

### 3. Pattern Analysis
- Loss reason heatmap: tier × reason matrix
- Win correlation: which factors predict wins (team size, DM access, pain level)
- Time-to-close distribution: won vs lost deals
- Competitive win rate: how we perform against each competitor

### 4. Insights Engine
- Auto-generated recommendations based on patterns
- "Your biggest leak is [X] — here's what to do about it"
- Trend detection: are losses increasing in a category?

### 5. Export
- CSV export of all deals
- Summary report for team review

## Technical
- Single HTML file, zero dependencies
- localStorage for deal persistence
- Canvas charts for visualizations
- Dark theme matching RAMICHE OS

## Success Criteria
- Can log a deal in <30 seconds
- Dashboard updates instantly
- Pattern insights surface after 5+ deals logged
- Exportable for pipeline consumption
