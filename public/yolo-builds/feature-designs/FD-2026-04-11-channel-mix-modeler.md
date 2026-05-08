# FD-2026-04-11: Channel Mix Modeler

**Agent:** Simons
**Lane:** Data & Analytics
**Status:** Built
**Date:** 2026-04-11

## Problem

Marketing budget allocation across channels is typically done by gut feel or last-touch attribution. Without modeling diminishing returns, brands overspend on saturated channels and underspend on high-marginal-return ones. GA and RAMICHE need a tool to optimize $5-50k monthly budgets across Meta, Google, TikTok, Email, Organic, and Influencer channels.

## Solution

Single-page interactive modeler with:
1. Configurable diminishing returns curves per channel (logistic, sqrt, log)
2. Budget slider + per-channel allocation sliders
3. Automated optimizer (gradient ascent on marginal ROAS)
4. 4 charts: revenue bars, ROAS bars, response curves, marginal ROAS
5. Auto-generated insights: saturation alerts, concentration risk, next-dollar recommendation

## Key Design Decisions

- **3 curve types** rather than one — different channels exhibit different response shapes (social = S-curve, email = log, search = sqrt)
- **Gradient ascent optimizer** over brute-force — converges in <200 steps, smooth enough for interactive use
- **Half-Kelly parallel** — optimizer never concentrates >80% in one channel, similar to position sizing discipline
- **Attribution window modeled** — longer windows inflate multi-touch channels (Meta, Influencer), surfacing a common analytics trap

## Validation

- Verified all 3 curve models produce monotonically increasing revenue with increasing spend
- Optimizer converges to different allocations for ROAS vs Revenue vs Balanced modes
- Sub-1x ROAS channels correctly flagged in insights
- Allocation bar accurately warns on over/under 100%
