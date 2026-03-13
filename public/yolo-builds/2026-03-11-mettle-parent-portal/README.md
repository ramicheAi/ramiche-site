# METTLE Parent Portal Dashboard

Interactive parent-facing dashboard for the METTLE athlete management platform. Parents see their child's progress, METTLE level advancement, meet schedule, best times, achievements, and coach communications — all in one place.

## How to Run

Open `index.html` in any modern browser. No build step or dependencies required.

## Features

- **Overview tab:** Athlete hero card, season stats (12 meets, 7 PBs, 94% attendance), METTLE level progress bar with milestone tracker (Rookie → Legend), recent activity timeline
- **Progress tab:** XP breakdown by category (meets, PBs, attendance, achievements, team), season performance trend chart (canvas-rendered bar chart with trend line), time improvement log
- **Meets tab:** Upcoming meets with events entered, past meets with PB count and placement results
- **Best Times tab:** SCY and LCM tables with time drops calculated automatically
- **Trophies tab:** 16-achievement trophy case (9 earned, 7 locked) with visual card grid
- **Alerts tab:** Push notifications for meets, PBs, level-ups, coach messages, practice reports
- **Settings tab:** Notification toggles, display preferences, linked athletes
- **Quick Actions bar:** Floating bottom bar for one-tap access to Next Meet, Best Times, Alerts
- **Ambient particles:** Purple particle background (METTLE brand, Living Experience Philosophy)

## Seeded With

- Saint Andrew's Aquatics (METTLE beta team)
- Athlete: Marcus Williams, Age Group 13-14, Warrior level (680/1000 XP)
- Realistic SCY + LCM best times, 4 past meets, 3 upcoming meets

## What's Missing / Next Steps

- Wire to Firestore for real athlete data (replace demo seed)
- Push notification integration (browser Notification API)
- Multi-athlete switcher (linked siblings)
- Coach messaging thread (two-way)
- Meet-day live results feed
- PDF export for season reports
- Mobile app wrapper (PWA or Capacitor)
