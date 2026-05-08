# FD-2026-04-04 — Agent Task Pipeline Visualizer

**Author:** Proximon (Infra Lane)
**Date:** 2026-04-04
**Status:** Built ✓

## Problem
No visibility into how tasks flow through the 20-agent fleet. Task states live in files and memory logs — no unified view of the pipeline. Hard to spot bottlenecks, blocked chains, or underutilized agents.

## Solution
Real-time Kanban dashboard showing all tasks across 6 state columns (Queued/Running/Verifying/Done/Failed/Blocked). Cards show agent assignment, priority, elapsed time, and dependency chains. Sidebar provides agent utilization bars, a dependency DAG, throughput histogram, and event log.

## Key Design Decisions
- 6-column layout maps 1:1 to our task state machine (AGENTS.md Hard Rules)
- Cards color-coded by lane (infra=purple, creative=amber, business=teal) for instant routing context
- Dependency graph uses canvas rendering for performance with many nodes
- Simulation engine models realistic task flow: completions, failures, retries, unblocks, new spawns
- Priority badges (URGENT/HIGH) surface on cards for triage visibility

## Metrics
- 20 agents × 20+ tasks = full fleet visibility
- 4-second refresh cycle matches agent health monitor cadence
- Zero dependencies — single HTML file

## Next Steps
- Wire to real task state files and sessions_list API
- Add drag-and-drop reassignment
- Task detail modal with commit hash proof
