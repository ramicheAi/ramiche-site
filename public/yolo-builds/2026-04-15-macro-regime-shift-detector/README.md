# Macro Regime Shift Detector — DR STRANGE

**Agent:** DR STRANGE (Scenario Modeling)
**Built:** 2026-04-15 @ 2:30 AM
**Type:** YOLO Overnight Build

## What It Does

Interactive macroeconomic regime detection dashboard. Identifies the current market regime (Expansion, Inflationary, Recession, Transition, Deflation) and models transition probabilities to the next regime.

### Dashboard Sections

- **Regime Badge + Confidence** — Current regime classification with confidence score and shift risk alert
- **Leading Indicators Panel** — 10 macro indicators (yield curve, ISM, PCE, unemployment, Fed funds, credit spreads, LEI, M2, consumer confidence, VIX) with directional signals
- **Regime Probability Chart** — 12-month probability trajectories for all 5 regimes
- **Markov Transition Matrix** — 5×5 regime transition probabilities with current-row highlighting
- **Recommended Asset Allocation** — Portfolio weights with change deltas per regime
- **Signal Timeline** — Chronological event stream of macro signals driving regime classification
- **Composite Index** — Weighted indicator composite showing expansion/contraction territory over trailing 12 months

### Preset Scenarios

1. **Current Baseline** — Real-time snapshot, moderate shift risk
2. **Fed Pivot to Easing** — Rate cuts begin, transition regime dominant
3. **Stagflation Shock** — Growth stalls + inflation re-accelerates (1970s playbook)
4. **Hard Landing** — Full recession, defensive positioning
5. **Goldilocks (Soft Landing)** — Inflation cools + growth holds, maximum risk-on

## Tech

- Single-file HTML/JS/CSS
- Chart.js for probability and composite charts
- Dark terminal aesthetic (SF Mono)
- Fully responsive grid layout
- No external dependencies beyond Chart.js CDN

## How to Use

1. Open `index.html` in any browser
2. Click scenario presets on the left panel
3. Watch regime probabilities, asset allocation, and signals update
4. Use transition matrix to assess where the regime is heading next
