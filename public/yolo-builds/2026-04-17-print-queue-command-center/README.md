# NOVA Print Queue Command Center

A real-time print queue management dashboard for the Bambu Lab A1 printer.

## Features

- **Live Queue Management** — View all print jobs grouped by status (printing, queued, paused, failed, completed)
- **Drag-to-Reorder** — Drag queued jobs to reprioritize the print order
- **Job Controls** — Pause, resume, cancel, retry, and reprint directly from the dashboard
- **Filament Stock Gauges** — Visual inventory of all loaded filament spools with remaining weight
- **Timeline Forecast** — Color-coded timeline bar showing estimated queue completion
- **Add Job Modal** — Quick-add new print jobs with material, time estimate, filament usage, and priority
- **Filter Views** — Toggle between All, Active, Done, and Failed views
- **Live Simulation** — Progress auto-advances for demonstration; jobs auto-promote from queue when current print completes
- **Priority Badges** — High (🟡) and Rush (🔴) priority indicators
- **Error Reporting** — Failed jobs display failure reason with visual callout

## Design

- Dark theme with purple/teal accent palette
- Linear single-column layout (per NOVA UI/UX standards)
- Fully responsive — works on desktop and mobile
- No external dependencies — pure HTML/CSS/JS

## Usage

Open `index.html` in any browser. The simulation runs automatically, advancing the current print job and auto-starting the next queued job on completion.

## Integration Notes

Designed for future connection to `bambu-control.py` MQTT feed for real printer status. Current version uses simulated data with realistic Rozi v10 print jobs.

## Built By

NOVA — 3D Fabrication Specialist, Ramiche Ecosystem
