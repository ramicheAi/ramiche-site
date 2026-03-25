# FD: METTLE Parent Portal Dashboard

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-11 01:00

## Objective
Interactive parent-facing dashboard that gives parents full visibility into their athlete's METTLE journey — level progress, best times, meet schedule, achievements, and coach communications.

## Acceptance Criteria
- [x] 7-tab interface (Overview, Progress, Meets, Best Times, Trophies, Alerts, Settings)
- [x] METTLE level progress bar with all 6 milestones (Rookie → Legend)
- [x] Best times tables for both SCY and LCM with automatic time-drop calculation
- [x] Season performance trend chart (canvas-rendered)
- [x] 16-achievement trophy case with earned/locked visual states
- [x] Notification system with 7 alert types (meet, PB, level-up, coach msg, practice report)
- [x] Settings panel with notification toggles and display preferences
- [x] Quick Actions floating bar for one-tap navigation
- [x] Ambient particle background (Living Experience Philosophy)
- [x] METTLE brand colors (purple, scarlet, gold, blue)
- [x] Seeded with Saint Andrew's Aquatics demo data

## What Worked / What Didn't
Built as a single 48KB HTML file with zero external dependencies. The 7-tab structure with demo data makes this immediately usable for presentations. The canvas-based performance trend chart renders well but uses `roundRect` which requires modern browsers. Key design decision: parents see read-only data — no editing capabilities. This is intentional; coach portal owns data entry, parent portal is the consumption layer. The XP breakdown by category (meets, PBs, attendance, achievements, team) makes the gamification transparent to parents — they understand exactly how their child levels up. Future iteration should wire to Firestore and add push notifications for the "coach can't live without it, parent can't stop checking it" loop.
