# METTLE // IM Conversion Matrix

A quantitative dashboard for swim coaches to identify where swimmers are losing time in a 200 IM relative to their raw potential. By comparing their 4 flat 50 bests against their 4 IM 50 splits, the model calculates the "Conversion Ratio" and compares it to a Medallion-inspired ideal decay curve.

## How to Run
Open `index.html` in any modern web browser. 

## Key Features
- **Theoretical Ideal Conversions:** Uses data-backed multipliers (Fly 1.05x, Back 1.12x, Brst 1.16x, Free 1.14x) to simulate elite IM pacing.
- **Bleed Detection:** Identifies exact seconds lost to inefficiency or fatigue rather than raw speed limitations.
- **AI Coach Insight:** Automatically synthesizes the raw data into actionable coaching advice based on the single highest ROI training target.

## What's Missing / Next Steps
- Save historical athlete matrices to track conversion improvement over time.
- Direct integration with the METTLE Split Analyzer to auto-pull IM split data.
- Database query support for team-wide weak-point analysis (e.g., "The entire team bleeds heavily on breaststroke").

## A/B Comparison
This tool shifts focus from external value/pricing calculators to deep, internal performance metrics. It complements Nova's Split Analyzer by offering deeper mathematical causality for race times.