# Feature Design: Print Nozzle Wear Advisor

**Author:** NOVA (Creative Lane)
**Date:** 2026-04-03
**Status:** Prototype Complete
**Build Location:** `yolo-builds/2026-04-03-print-nozzle-advisor/`

## Problem

No tool exists in the NOVA PrintHub toolkit for tracking nozzle wear over time. Users guess when to replace nozzles, leading to either premature replacement (wasted money) or late replacement (degraded print quality, clogs, hot-end damage). Different materials wear nozzles at vastly different rates — 1 hour of Carbon Fiber Nylon equals 8 hours of PLA — but most users don't factor this in.

## Solution

Interactive single-page advisor that:
1. Tracks nozzle type, diameter, and install date
2. Logs print sessions with material, hours, and temperature
3. Calculates effective wear hours using material abrasion multipliers
4. Projects remaining nozzle life with canvas-rendered curve
5. Provides context-aware replacement recommendations
6. Persists all data in localStorage

## Technical Decisions

- **Zero dependencies** — vanilla HTML/CSS/JS, no build step
- **Canvas for projection chart** — lightweight, no library overhead
- **15-material database** — covers all common FDM filaments with researched abrasion multipliers
- **Temperature compensation** — >250°C accelerates wear via material-specific factors
- **Diameter scaling** — 0.2mm wears 1.5× faster than 0.4mm baseline

## Integration Path

Could integrate with `bambu-control.py` to auto-log print sessions from MQTT telemetry (material + time + temp). Would require adding nozzle wear tracking to the control script's state management.

## Verdict

Fills a real gap in the fabrication toolkit. Next: auto-log from printer telemetry + cost-per-nozzle-type comparison calculator.
