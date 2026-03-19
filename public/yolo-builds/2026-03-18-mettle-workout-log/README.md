# METTLE Workout Log

Mobile-first athlete workout journal for swimmers. Log daily practice performance — yardage, duration, RPE (1-10), set types, focus areas, and freeform notes. Tracks volume over time with a weekly bar chart, maintains streak counting with XP bonuses, and includes a goals system with progress tracking.

## How to Run

Open `index.html` in a browser. Mobile-optimized — works best at phone width.

## Features

- **Log Tab:** Date, 8 set types (warmup/main/kick/drill/sprint/pull/IM/cooldown), yardage + duration inputs, RPE 1-10 slider with color-coded feedback, 10 focus area tags, freeform notes, live XP preview on submit button
- **History Tab:** Reverse-chronological workout cards with RPE badges, type pills, focus tags, notes, XP earned. Long-press to delete.
- **Stats Tab:** Weekly volume bar chart, avg RPE, total logs, best streak, top focus area breakdown
- **Goals Tab:** 5 goals (weekly volume, streak, total logs, hard effort, XP milestone) with progress bars and XP rewards
- **XP System:** Base 25 XP + bonuses for hard effort (+10), big volume (+15), variety (+5), streaks (+10/25/50)
- **METTLE Levels:** Rookie → Rising → Contender → Warrior → Champion → Legend
- **Demo Data:** 6 pre-seeded workouts from the past week with realistic swim practice data

## What's Missing / Next Steps

- Firestore sync for real athlete data persistence
- Coach visibility — coach portal sees aggregate team workout logs
- Integration with Practice Planner (coach creates set → athlete logs how it went)
- Photo/video attachment for technique review
- Weekly summary push notification to parents
- Export to PDF/CSV for season review

## A/B Comparison

Bridges the gap between coach-side Practice Planner (builds sets, Mar 14) and athlete-side Check-In (tracks attendance, Mar 16). This is where the athlete records HOW the workout went — the reflection layer that makes training intentional.
