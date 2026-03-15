# FilaTrack — Filament Inventory & Cost Tracker

Interactive single-page tool for managing 3D printer filament inventory, logging print jobs with automatic spool deduction, tracking material costs per gram, and surfacing low-stock alerts. Built for the Bambu Lab A1 production pipeline.

## How to Run

Open `index.html` in any browser. No build step, no dependencies, no server required.

## Features

- **Spool Inventory** — Add/edit/delete spools with material type, brand, color (visual preview), weight, cost, print temp, notes
- **Auto-defaults** — Selecting a material pre-fills typical temp and cost values (PLA/PETG/ASA/TPU/ABS/Nylon/PC/CF blends)
- **Print Log** — Log each print with spool used, grams consumed, duration, status (success/failed/partial), notes
- **Auto-deduct** — Logging a print automatically reduces the spool's remaining weight
- **Low Stock Alerts** — Spools below 25% trigger warnings; below 15% trigger critical alerts with pulsing indicators
- **Cost Analytics** — Per-print cost, average $/gram, material-level cost breakdown
- **Header Stats** — Total spools, inventory weight (kg), inventory value
- **Demo Data** — Seeds with 6 realistic Bambu/eSUN spools and 8 print log entries on first load
- **Data Management** — Export/import JSON, export CSV for spreadsheets, full reset
- **Ambient UI** — Floating particle canvas, 72 BPM header pulse, dark theme with purple/gold accents

## What's Missing / Next Steps

- Integration with Bambu Lab MQTT to auto-detect print completion and filament usage
- Photo attachment per print log (failure documentation)
- Spool barcode/QR scanning via camera
- Reorder links to supplier pages
- Print queue forecasting (will this spool last for the queued jobs?)
- Multi-printer support
