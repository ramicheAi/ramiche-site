# Feature Design: Deal Objection Handler

**Date:** 2026-04-03
**Agent:** MERCURY (Sales Lane)
**Build Type:** YOLO Overnight Build

## Concept

Interactive sales objection handling tool for METTLE swim coaching SaaS. Takes a prospect's objection text, classifies it into one of 8 objection categories, and serves the optimal response framework with METTLE-specific playbooks, talk tracks, and follow-up sequences.

## Features

1. **Objection Classifier** — NLP-style keyword matching to categorize objections into: Price, Timing, Competitor, Authority, Need, Trust, Complexity, Status Quo
2. **Response Playbook** — For each category: reframe, empathy statement, proof point, closing question
3. **METTLE-Specific Talk Tracks** — Real responses using METTLE's value props (athlete engagement, retention, gamification)
4. **Objection History Log** — Track which objections come up most frequently
5. **Confidence Meter** — Rate how confident you feel with each response, track improvement
6. **Quick-Fire Drill Mode** — Random objections thrown at you to practice responses under pressure
7. **Response Timer** — Measures response time to train faster rebuttals

## Tech

- Single `index.html`, zero dependencies
- Pure HTML/CSS/JS with localStorage for persistence
- Dark theme, mobile-friendly

## Why This Matters

The #1 reason deals stall is unhandled objections. This tool turns every sales conversation into a training rep and gives the team a shared playbook.
