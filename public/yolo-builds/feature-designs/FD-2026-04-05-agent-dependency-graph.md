# Feature Design: Agent Dependency Graph Visualizer

**Date:** 2026-04-05
**Builder:** Proximon (Systems & Optimization)
**Lane:** Infra

## What It Does

Interactive force-directed graph visualization of the entire RAMICHE 20-agent ecosystem. Maps every agent-to-agent dependency, communication lane, and bottleneck risk in real-time.

## Key Features

1. **Force-Directed Graph Layout** — Agents positioned by physics simulation, clustered by lane (Infra/Creative/Business). Atlas pinned at center as the hub.

2. **Bottleneck Detection** — Composite scoring: `outDegree × criticality × (transitiveDependents + 1)`. Highlights high-risk nodes with glow effects. Identifies Single Points of Failure (SPOF).

3. **Lane Filtering** — Toggle between All/Infra/Creative/Business to isolate communication domains.

4. **Failure Simulation** — Click "Simulate Failure" + select any agent to see cascade impact: direct dependents, transitive dependents, % of ecosystem affected. Visual: red dashed edges, warning glows on impacted nodes.

5. **Detail Panel** — Per-agent metrics: criticality, bottleneck score, in/out degree, transitive deps, SPOF status, dependency tree, skills inventory.

6. **Pan/Zoom/Hover** — Full canvas interaction with mouse wheel zoom, drag-to-pan, hover tooltips.

## Architecture

Single `index.html`, zero dependencies. Canvas 2D rendering with custom force simulation (300 iterations). All 20 agents from AGENTS.md routing table encoded with real dependency relationships.

## Insights Surfaced

- **Atlas is the biggest SPOF** — 19 transitive dependents (95% ecosystem). If Atlas goes down, everything stops.
- **Proximon + Widow + TRIAGE** form the infra backbone — high criticality, multiple dependents.
- **Business lane has most leaf nodes** — Prophets, SELAH, MICHAEL are low-risk (few dependents, low criticality).
- **Creative lane chains through Aetherion** — single creative bottleneck for design decisions.

## Why This Matters

Agent orchestration is the #1 infrastructure challenge at scale. This tool turns invisible dependency relationships into visible, measurable risk. Directly supports the Phase 1 multi-lane routing architecture.
