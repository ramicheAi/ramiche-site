# METTLE Athlete Check-In

Mobile-first kiosk app for athletes to self-check-in at practice using a 4-digit PIN. Tracks attendance streaks, awards XP, and gives coaches real-time roster visibility.

## How to Run

Open `index.html` in any browser. Works on phone, tablet, or poolside laptop. Demo mode seeds with 9 pre-checked-in athletes from Saint Andrew's Aquatics.

## Features

- **PIN-based check-in** — numpad UI optimized for quick poolside entry
- **XP rewards** — 15 XP per check-in + streak bonuses (5-50 XP at milestones)
- **Attendance streaks** — consecutive practice counter with leaderboard
- **Live roster** — searchable, shows who's in/out with METTLE levels
- **Streak leaderboard** — gold/silver/bronze rankings, gamified competition
- **Coach quick panel** — floating FAB shows attendance rate and missing athletes by group
- **Stats tab** — weekly attendance bar, activity log, team averages
- **LocalStorage persistence** — daily state persists without backend
- **24 demo athletes** across Senior, Junior, and Age Group squads

## What's Missing / Next Steps

- Firestore integration for real athlete database
- QR code check-in option (scan team QR → auto-check-in)
- Parent push notification on check-in ("Your child arrived at practice")
- Coach override for manual check-in/undo
- Late arrival flagging (after warmup window)
- Integration with Practice Planner (Mar 14 build) for session context

## A/B Context

Previous METTLE builds targeted coaches (Practice Planner, Meet Day), parents (Parent Portal), and recruitment (Recruitment Portal). This is the first build targeting the ATHLETE directly — daily engagement hook that makes METTLE a habit, not a tool.
