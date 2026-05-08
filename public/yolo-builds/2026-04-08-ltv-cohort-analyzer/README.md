# LTV Cohort Analyzer — SIMONS Data & Analytics

Interactive customer lifetime value dashboard with cohort retention analysis, LTV/CAC ratios, and collector tier progression modeling across all RAMICHE brands.

## What It Does

- **KPI Strip** — Avg LTV, CAC, LTV/CAC ratio, total customers, payback period, M1 retention at a glance. Color-coded by health thresholds.
- **Retention Curves** — Brand-averaged retention decay over time. Identifies which brands retain customers best and where dropoff accelerates.
- **Cumulative LTV per Customer** — Margin-adjusted revenue accumulation with CAC breakeven lines. Shows payback timing per brand.
- **LTV/CAC Ratio** — Bar chart with 1.0x payback and 3.0x target lines. Instantly shows which brands are sustainable.
- **Revenue by Cohort Month** — Stacked bar chart showing monthly revenue contribution by brand. Reveals growth trajectory and seasonal patterns.
- **Cohort Health Matrix** — Retention heatmap: cohort months (rows) × months since acquisition (columns). Color intensity = retention strength.
- **Entry Product Distribution** — Which products customers buy first, ranked. Critical for optimizing top-of-funnel.
- **Cross-Brand Conversion** — % of customers purchasing from 2+ brands over time, with 20% target line.
- **Collector Tier Progression** — Explorer → Seeker → Keeper → Archivist distribution by month. Tracks Relic Points ecosystem health.

## Controls

| Control | Options | Effect |
|---------|---------|--------|
| Brand | All / GA / RAMICHE / Parallax / Studio | Filter all charts to specific brand |
| Time Horizon | 12 / 18 / 24 months | Extend projection window |
| CAC Scenario | Low / Mid / High | Model different acquisition cost environments |
| Export CSV | Button | Download full cohort data |

## Data Model

- **Retention:** Shifted beta decay with brand-specific base rates and noise. Studio retains best (0.88 base, 0.95 decay), Parallax worst (0.74 base, 0.88 decay).
- **Cohort sizing:** Brand-specific bases with 6% monthly acquisition growth and seasonal wave.
- **Revenue:** Active customers × purchase probability × AOV × margin %.
- **LTV:** Cumulative margin-adjusted revenue per customer head.
- **CAC scenarios:** Low ($5-15), Mid ($8-25), High ($12-40) per brand.
- **Tier progression:** Time-based model with diminishing Explorer % and growing Seeker/Keeper/Archivist shares.

## Key Insights This Reveals

1. **Which brands justify acquisition spend** — Studio has highest LTV/CAC despite highest CAC (margin dominance).
2. **Retention cliff detection** — Where M1→M3 dropoff is steepest = highest-priority fix.
3. **Cross-brand flywheel health** — Conversion rate trending toward 20% target validates ecosystem strategy.
4. **Payback timing** — Months to CAC recovery tells you how much runway each brand needs.
5. **Entry product optimization** — Sticker packs and cases dominate GA entry (low barrier) but merch tees dominate RAMICHE.

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Single HTML file.

## What's Missing / Next Steps

- Connect to Shopify API for real cohort data (order history → actual retention curves)
- Pull actual CAC from ad platform APIs (Meta, Google)
- Integrate with Relic Points system for real tier progression data
- Add predictive LTV modeling (project forward based on observed retention)
- Monte Carlo confidence intervals on LTV projections
- Cohort comparison tool (overlay two specific cohorts)
- Wire to dashboard_api.json for Finance HQ integration

## Built By

SIMONS (Data & Analytics Lane) — April 8, 2026
