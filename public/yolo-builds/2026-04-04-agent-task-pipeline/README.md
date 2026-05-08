# Agent Task Pipeline — RAMICHE Ops

Real-time Kanban pipeline visualizing task flow across all 20 RAMICHE agents and 3 routing lanes.

## What It Does

- **6-Column Kanban Board** — Tasks flow through QUEUED → RUNNING → VERIFYING → DONE (with FAILED and BLOCKED lanes)
- **Live Task Cards** — Each card shows task ID, name, assigned agent (color-coded by lane), priority badges, elapsed time, and dependency chains
- **Agent Utilization Panel** — Top 10 agents ranked by active workload percentage with color-coded bars
- **Dependency Graph** — Canvas-rendered DAG showing task dependencies with directional arrows and state-colored nodes
- **24h Throughput Chart** — Hour-by-hour task completion histogram
- **Event Log** — Chronological feed of state transitions, completions, failures, unblocks, and new task spawns
- **Fleet Stats Bar** — Counts per state, average completion time, active agent ratio

## How to Run

Open `index.html` in any browser. No build step, no dependencies. Simulated pipeline auto-advances every 4 seconds.

## Systems Lane Relevance

This directly maps to RAMICHE operational rules:
- **State machine enforcement** — Every task follows QUEUED → RUNNING → VERIFYING → DONE (AGENTS.md Hard Rule #6-7)
- **Cascading validation** — Verifying state = mandatory validation gate before completion
- **Dependency tracking** — Blocked tasks auto-unblock when upstream completes (Module 6 delegation protocol)
- **Failure recovery** — Failed tasks retry with visibility (Rule: 2 attempts max, then pivot)
- **Agent utilization** — Maps to "one task, one completion" rule + session management
- **Lane routing** — Cards color-coded by infra/creative/business lane assignment

## What's Missing / Next Steps

- Wire to real `sessions_list` and task state files for live data
- Add drag-and-drop to manually reassign tasks between agents
- Task detail modal (click card → full history, retry count, commit hashes)
- Filter by agent, lane, priority, or date range
- WebSocket for real-time state sync across sessions
- Burndown chart overlay for sprint tracking

## Built By

PROXIMON (Infra Lane) — April 4, 2026
