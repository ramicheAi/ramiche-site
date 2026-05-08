# Dividend Reinvestment Compounder — SIMONS

Interactive dividend reinvestment modeling tool that compares DRIP vs. cash payout strategies over configurable time horizons.

## Features

- **Compound Growth Curves:** Side-by-side chart of DRIP vs. cash payout portfolio value over 1-30 years
- **Yield-on-Cost Tracker:** Shows how effective yield grows when dividends buy more shares at varying prices
- **Tax Drag Analysis:** Models qualified vs. ordinary dividend tax rates and their compound impact
- **Dividend Growth Modeling:** Projects future dividends with configurable annual growth rate (dividend aristocrat patterns)
- **Scenario Table:** Year-by-year breakdown of shares owned, dividends received, reinvested value, cumulative tax paid, and total portfolio value
- **Quick Presets:** Pre-loaded with CVX, SPG, AAPL dividend profiles for Ramon's portfolio

## Inputs

- Initial shares, current price, current annual dividend per share
- Dividend growth rate (%), expected price appreciation (%)
- Tax rate (qualified/ordinary), reinvestment strategy (full DRIP / partial / cash)
- Time horizon (years), dividend frequency (quarterly/monthly/annual)

## Design

- Single-file HTML, no dependencies
- Dark theme (RAMICHE OS design system)
- All calculations client-side with Canvas charts
- Disclaimer included per compliance requirements

## Lane

Data & Analytics (SIMONS)
