# FD: PrintQueue — Production Queue Manager

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-05 01:00

## Objective
Built a full production queue manager for the Bambu Lab A1 that tracks print jobs through their lifecycle (queued → printing → completed/failed) with priority ordering, material stock tracking, cost calculations, and live progress simulation.

## Acceptance Criteria
- [x] Job queue with 4 priority levels and visual status indicators
- [x] Live print progress with animated bars and time-remaining estimates
- [x] Machine status sidebar with nozzle/bed temps and heartbeat indicator
- [x] Material inventory tracker with low-stock warnings and auto-deduction
- [x] Add job modal with full form (material, priority, time, weight, customer, price, notes)
- [x] Job actions: start, complete, abort, requeue, bump priority, remove
- [x] Activity log tracking all queue operations
- [x] Cost tracking (material cost per job + revenue)
- [x] LocalStorage persistence
- [x] Dark theme with ambient particles matching Parallax Living Experience spec
- [x] Responsive layout (sidebar collapses on mobile)
- [x] Seeded with realistic demo data (Galactik Antics, METTLE, Etsy orders)

## What Worked / What Didn't
Single-file HTML approach continues to be the right call for YOLO builds — 32KB of self-contained functionality with zero dependencies. The priority sorting system works well for queue ordering. Material stock validation prevents starting jobs when stock is insufficient. The simulated progress auto-completes jobs which makes the demo feel alive. Seeding with real Parallax ecosystem data (Galactik Antics phone cases, METTLE trophies) makes it feel production-ready. Future integration point: MQTT connection to the actual Bambu A1 at 10.0.0.219 would replace the simulation with real telemetry.
