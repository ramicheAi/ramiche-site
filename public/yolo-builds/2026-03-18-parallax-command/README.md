# PARALLAX COMMAND — Business Intelligence Cockpit

A strictly ultra-linear, mobile-first dashboard summarizing the entire Parallax ecosystem (Ventures, Revenue, Agents, Health).

## Design Philosophy

- **Ultra-Linear:** Single-column layout, max-width 540px. No side-by-side grids unless absolutely necessary for micro-metrics.
- **Unconventional UI:** Glassmorphism headers, staggered entrance animations, high-contrast typography (Inter + JetBrains Mono).
- **Mobile First:** Designed to look like a premium native iOS app feed.
- **Light Mode Only:** Adheres to RAMICHE OS constraint (No Dark Mode).

## Data Integration

- **Ventures:** METTLE (Beta), Verified Agents (Dev), Studio (Live), ClawGuard (Live).
- **Pipeline:** Real-time projected revenue ($217.5K total pipeline).
- **Agents:** Live status of 19 agents + YOLO leaderboard stats.
- **Health:** System vitals (Burn rate, Token usage, Disk space).

## Tech Stack

- Single HTML file (Zero dependencies)
- CSS Variables for strict theming
- SVG Canvas for health rings
- Keyframe animations for "alive" feel
