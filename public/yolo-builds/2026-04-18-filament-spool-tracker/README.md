# NOVA Filament Spool Tracker

A visual inventory management tool for 3D printing filament spools.

## Features

- **Spool Inventory** — Track all filament spools with color swatches, material type, brand, weight, and temperatures
- **Usage Logging** — Log filament usage per spool with a subtract modal; remaining weight auto-updates with visual progress bars
- **Cost Analysis** — Total invested, value used, value remaining, avg spool cost, cost-per-gram calculations
- **Low Stock Alerts** — Automatic warnings when spools drop below 15% or reach empty
- **Material Reference Guide** — Quick-reference cards for PLA, PETG, ABS, TPU, ASA, and Nylon with temp ranges
- **Export/Import** — JSON export for backup, JSON import for restore
- **Demo Data** — One-click load with 6 realistic spools (Bambu Lab, Polymaker, eSUN, NinjaTek, Prusament)
- **localStorage Persistence** — Data survives browser refreshes, no server needed

## Design

- Dark theme, linear single-column layout
- Color swatches with highlight dots
- Material-coded badges (each material gets its own color)
- Green/yellow/red weight bars based on remaining percentage
- Responsive grid — stacks cleanly on mobile

## Stack

Single-file HTML/CSS/JS. No dependencies. Open `index.html` in any browser.

## Built By

NOVA @ RAMICHE OS — April 18, 2026
