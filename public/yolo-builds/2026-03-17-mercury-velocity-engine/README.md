# Mercury Velocity Engine

Sales intelligence system that monitors funding rounds, exec hires, and DTC brand signals — then auto-generates pitch deck outlines from any company URL.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- Signal scanner: RSS monitoring for >$10M funding rounds, CMO/Head of Brand hires, DTC keywords
- Deck scaffold: Feed any URL → extracts brand vibe (title, description, hex colors) → generates 4-slide pitch outline
- Dashboard: View captured signals, generated decks, and trigger new scans
- High-value filter: Only surfaces actionable leads (>$10M or strategic hires)
- Deduplication: Won't log the same signal twice

## Stack

- Python backend (signal_watcher.py, deck_scaffold.py, dashboard.py)
- HTML/JS frontend (index.html — interactive dashboard)
- feedparser, requests, beautifulsoup4

## What's Missing

- Auto-trigger: Signal → Deck pipeline not yet wired
- CRM integration: Push leads to HubSpot automatically
- Email drafts: Auto-generate cold outreach from signal context
- Scheduling: Cron-based signal scanning
