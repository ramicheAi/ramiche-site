# METTLE // Decision War Game

Interactive branching scenario engine for METTLE business strategy. Model business decisions across 4 quarters and see cascading 12-month impacts on revenue, churn, growth, and market share.

## How to Run

Open `index.html` in any browser. No build step, no dependencies.

## Features

- **16 strategic decisions** across 4 quarters (pricing, growth, scale, optimization)
- **Simulation engine** with market saturation dampening, moat effects, and compounding dynamics
- **Canvas-rendered** MRR trajectory charts with baseline comparison
- **3-path comparison** — your scenario vs do-nothing vs optimal path
- **Sensitivity analysis** — 8 variable stress tests showing ARR impact
- **3 templates** — Conservative, Base Case, Aggressive starting positions
- **Export** — JSON, CSV, and text summary formats

## What's Missing / Next Steps

- Save/load multiple scenario paths for side-by-side comparison
- Monte Carlo randomness overlay on deterministic projections
- Integration with actual METTLE Firestore data for real baseline numbers
- Decision dependency constraints (can't do enterprise tier before mobile app)
