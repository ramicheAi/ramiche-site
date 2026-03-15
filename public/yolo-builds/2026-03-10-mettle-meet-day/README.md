# METTLE — Meet Day Command Center

A real-time command center for swim coaches on meet day. Track events, warmup countdowns, athlete status, heat/lane assignments, results with split times, and PB drops — all in one view.

## How to Run

Open `index.html` in any browser. No build step, no dependencies, no server needed.

## Features

- **Live clock** with meet info header (heartbeat glow animation)
- **Stats bar** — athletes, events, completed, PBs dropped, next event time
- **5 tabs:**
  - **Events** — full event timeline with expandable heat/lane grids, athlete seed times, status indicators (upcoming/warmup/racing/complete)
  - **Warmups** — countdown cards for each upcoming event with progress bars, urgent state when < 5 min
  - **Roster** — 24 athletes with METTLE level badges, event tags, status tracking, search + filter
  - **Results** — full results table with place, time, seed, +/- diff, split times. Gold/silver/bronze styling. PB drops highlighted in green
  - **Activity** — chronological event log with icons
- **Quick actions** — floating bottom bar (Advance Event, Warmup Call, Confirm Relay, Scratch)
- **Simulation mode** — click "Advance Event" to step through warmup → racing → complete with auto-generated realistic results
- **METTLE branding** — purple/scarlet/gold/blue palette, Forged M logo, ambient particles, 72 BPM heartbeat
- **24 demo athletes** seeded with Saint Andrew's Aquatics data, METTLE levels (Rookie → Legend)
- **12 events** (individual + relays) with realistic heat/lane assignments
- **Responsive** — works on tablet and phone for poolside use

## What's Missing / Next Steps

- Real-time data integration with METTLE backend (Firestore)
- QR code check-in for athletes at warmup pool
- Push notifications to parents ("Your athlete is warming up for Event 7")
- Official times import from Hy-Tek/Meet Manager
- Photo capture + auto-tag for event results
- Coach notes per athlete per event
- PDF export of meet results summary
