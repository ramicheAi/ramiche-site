# Trade Position Analyzer — SIMONS

Interactive position sizing and P&L modeling tool for stock, crypto, and options trades.

## Features

- **P&L Curve:** Net profit/loss across -30% to +30% price moves, accounting for slippage, commissions, margin costs, and taxes
- **Risk/Reward Targets:** Visual bar chart showing dollar profit at 0.5:1 through 5:1 R/R ratios
- **Kelly Criterion Sizing:** Growth rate curve showing full Kelly, half-Kelly, and current position overlay
- **Targets Table:** Exact prices, gross/net P&L, and R-multiples for stop loss through 5R targets
- **Signal Analysis:** Automated risk warnings, Kelly-optimal share count, margin cost breakdown, expected value per trade

## Inputs

- Direction (long/short), asset type, entry price, share count
- Commission, slippage (bps), stop loss %
- Win rate estimate, account size
- Tax rate, margin rate, holding period, margin %

## Design

- Single-file HTML, no dependencies
- Dark theme (RAMICHE OS design system)
- All calculations client-side with Canvas charts
- Disclaimer included per compliance requirements

## Lane

Data & Analytics (SIMONS)
