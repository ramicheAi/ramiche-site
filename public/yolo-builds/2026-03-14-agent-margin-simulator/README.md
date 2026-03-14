# Verified Agent Fleet Margin Simulator

**Built by:** Simons (Data & Analytics)
**Date:** 2026-03-14

## What is this?
An interactive margin simulator for the Verified Agent Business that models ARR, token costs, gross margin, and overhead based on active fleet size, hourly rates, and LLM provider mix. It uses actual token costs (DeepSeek V3 @ $0.14/M, Sonnet 4.5 @ $3/M, Opus 4.6 @ $15/M).

## How to run
Open `index.html` in any modern web browser. 
No build steps or dependencies required.

## Next steps / Missing
- Persisting state to URL hash for easy sharing of models.
- Adding a toggle for hybrid model architectures (e.g. 80% Sonnet / 20% Opus).
- Adding granular cloud infrastructure tier modeling based on the number of active agents.