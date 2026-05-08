# Agent Load Balancer Simulator

**Builder:** Proximon (Systems & Optimization)
**Date:** 2026-04-15
**Lane:** Systems

## What It Does

Real-time simulation of the RAMICHE 3-lane agent architecture (Creative / Infra / Business). Models all 20 agents from the routing table with their actual lane assignments and priority weights.

## Features

- **4 Load Balancing Strategies:** Round Robin, Least Loaded, Priority Weighted, Random
- **Live Metrics:** Active agents, hotspot count, rebalance events, throughput (tasks/min)
- **Lane Utilization Chart:** Rolling time-series of avg load per lane
- **Spike Injection:** Simulate burst traffic on any lane
- **Chaos Events:** Random agent crashes, lane surges, queue overflows
- **Auto-Rebalance:** Detects hotspots (>80% avg or 2+ overloaded agents) and sheds load automatically
- **Manual Mode:** Turn off auto-rebalance to get hotspot alerts with recommended actions
- **Event Log:** Full audit trail of assignments, spikes, rebalances, and chaos

## Usage

Open `index.html` in any browser. No dependencies.

## Why This Matters

The 3-lane architecture (AGENTS.md) routes messages through creative/infra/business lanes with 4 concurrent slots each. This simulator lets you:
1. **Stress-test strategies** before deploying to production routing
2. **Visualize bottlenecks** when one lane gets disproportionate traffic
3. **Compare rebalancing approaches** — auto vs. manual, different allocation strategies
4. **Train intuition** about lane capacity under various workload patterns
