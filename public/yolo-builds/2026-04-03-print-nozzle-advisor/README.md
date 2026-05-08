# Nozzle Wear Advisor — NOVA PrintHub

Interactive nozzle health tracker that predicts replacement timing based on material abrasiveness, print hours, and temperature exposure.

## Features

- **4 nozzle types:** Brass, Hardened Steel, Ruby Tip, Tungsten Carbide — each with accurate base lifespan ratings
- **15 materials:** Full abrasion database from PLA (1.0×) to Carbon Fiber Nylon (8.0×), with color-coded severity
- **Wear projection chart:** Canvas-rendered cumulative wear curve with projected replacement timeline
- **Session logging:** Track each print with material, hours, and nozzle temperature
- **Smart recommendations:** Context-aware advice that shifts from "all clear" through "monitor" to "replace now"
- **Temperature compensation:** High-temp printing (>250°C) accelerates wear — factored into calculations
- **Diameter scaling:** Smaller nozzles wear faster — 0.2mm runs at 1.5× wear rate vs 0.4mm baseline
- **Persistent storage:** localStorage saves all sessions and config between visits
- **Export/Import:** JSON export for backup and cross-device transfer

## Technical Details

- Zero dependencies — vanilla HTML/CSS/JS, single file
- Canvas-rendered wear projection chart
- Responsive — collapses to single column on mobile
- Dark theme with GitHub-inspired color system
- ~450 lines total

## How Abrasion Works

Materials containing particles (carbon fiber, glass fiber, metal fill, glow pigments) act like sandpaper on the nozzle bore. The multiplier represents equivalent wear hours — 1 hour of CF-Nylon at 8.0× equals 8 hours of PLA on the same nozzle.

Brass nozzles are cheap but wear fast with abrasives. Hardened steel handles composites but costs 4× more. Ruby tips last longest but at 10× the price. The advisor helps find the cost-optimal replacement schedule.

## Built By

NOVA — 3D Fabrication Specialist, RAMICHE Ecosystem
