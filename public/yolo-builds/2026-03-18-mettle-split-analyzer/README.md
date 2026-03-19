# METTLE // Split Analyzer

Interactive swim race split analyzer for coaches. Paste or manually enter split times from any race event and get instant visual analysis.

## How to Run
Open `index.html` in any browser. No dependencies, no build step.

## Features
- 10 event types (50 Free through 200 IM, 200 Breast/Back/Fly)
- SCY/SCM/LCM course support
- Paste splits (comma/space separated) or enter manually
- Pacing curve chart (canvas-rendered, no libraries)
- Split breakdown table with diff-vs-average coloring
- Strategy detection: Negative Split, Positive Split, Even Split, Fly & Die
- Coaching recommendations per strategy type
- Stat cards: final time, fastest split, consistency (CV%), half differential
- Demo data presets for quick testing
- METTLE brand: purple/scarlet/gold/blue, monospace, no dark mode

## What's Missing / Next Steps
- Firestore integration for saving race analyses per athlete
- Side-by-side race comparison (same athlete, different meets)
- PDF export for meet reports
- Hy-Tek results file import (.hy3/.cl2 parsing)
- Stroke rate estimation from split deltas
- Historical trend chart (athlete improvement over season)
