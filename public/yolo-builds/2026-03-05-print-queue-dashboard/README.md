# PrintQueue — Production Queue Manager

Real-time print job queue manager for the Bambu Lab A1. Tracks jobs through their full lifecycle: queued → printing → completed/failed. Manages priority ordering, material stock tracking, cost calculations, and production statistics.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- **Job queue with priority ordering** — Urgent/High/Normal/Low with visual indicators
- **Live print progress** — Animated progress bars with time-remaining estimates and simulated advancement
- **Machine status panel** — Nozzle/bed temps, connection status with heartbeat indicator
- **Material stock tracker** — PLA/PETG/ASA/TPU inventory with low-stock warnings, auto-deduction on completion
- **Cost tracking** — Per-job material cost calculation, revenue tracking
- **Activity log** — Real-time event log for all queue operations
- **Add job modal** — Full form with material, priority, customer, pricing, notes
- **Job actions** — Start, complete, abort, requeue, bump priority, remove
- **LocalStorage persistence** — Queue state survives browser refresh
- **Keyboard shortcuts** — `N` to add job, `Esc` to close modal
- **Ambient particles + heartbeat animations** — Matches Parallax Living Experience spec
- **Dark theme, monospace, game-like UI** — Consistent with ecosystem design language

## Seeded Demo Data

Pre-loaded with realistic production queue including:
- Galactik Antics phone case (printing, PETG)
- METTLE Captain trophy prototype (urgent, queued)
- Etsy orders, internal prototypes
- One failed print with failure analysis

## What's Missing / Next Steps

- MQTT integration with Bambu A1 for real print progress
- Drag-and-drop reordering
- Calendar view for scheduling
- Integration with FilaTrack inventory system
- Print history analytics (charts, trends)
- Export to CSV/PDF for invoicing
