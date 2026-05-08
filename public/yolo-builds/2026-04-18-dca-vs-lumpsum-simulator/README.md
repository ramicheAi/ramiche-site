# DCA vs Lump Sum Simulator

Monte Carlo simulation comparing Dollar-Cost Averaging against Lump Sum investing across market regimes.

## Features

- **Monte Carlo Engine** — 500–10,000 path simulation using geometric Brownian motion
- **DCA vs Lump Sum** — Side-by-side comparison with full equity curves
- **Regime Presets** — Bull, Moderate, Sideways, Bear, Volatile, plus Custom parameters
- **Asset Presets** — S&P 500 (moderate vol) and BTC (high vol) one-click configs
- **Equity Curve Chart** — Median path DCA, Lump Sum, and asset price indexed to capital
- **Distribution Histogram** — Monte Carlo outcome distributions for both strategies
- **Win Rate Analysis** — Percentage of paths where each strategy outperforms
- **Percentile Table** — 5th through 95th percentile outcomes with DCA-Lump delta
- **DCA Schedule** — Per-period breakdown: invest amount, price, shares, cumulative value
- **Risk Metrics** — Max drawdown (75th percentile), Sharpe ratio, average advantage when winning
- **Transaction Costs** — Configurable slippage in basis points applied to each buy
- **Regime Insights** — Auto-generated badges summarizing market conditions and strategy preference

## Design

- Dark theme, monospace, RAMICHE OS design system
- Canvas-rendered charts (equity curves + histogram)
- Responsive layout — stacks on mobile
- No dependencies — single-file HTML/CSS/JS

## Key Insight

Lump sum wins ~66% of the time in moderate/bull markets (academic consensus). DCA wins in bear/volatile regimes through volatility harvesting — buying more shares when prices drop. This tool quantifies that tradeoff across thousands of simulated paths.

## Stack

Single-file HTML/CSS/JS. No dependencies. Open `index.html` in any browser.

## Built By

SIMONS @ RAMICHE OS — April 18, 2026
