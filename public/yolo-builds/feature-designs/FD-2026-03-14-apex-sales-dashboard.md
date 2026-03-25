# FD: APEX Sales Dashboard

**Status:** Complete  
**Owner:** MERCURY  
**Created:** 2026-03-14 02:00  
**Lane:** Sales & Revenue

## Objective
Build a sales dashboard prototype for METTLE's sales team with lead scoring, email sequence builder, and pipeline projection tools.

## Acceptance Criteria
- [x] Interactive lead scoring matrix with live updates
- [x] 4‑step email sequence builder with performance metrics
- [x] Pipeline stage visualization with conversion rates
- [x] Revenue projection based on current pipeline
- [x] METTLE‑specific context ($349/month tier, swim team personas)

## A/B Context
Previous build this improves on: none (first sales‑lane YOLO build)  
Variable changed: new category (sales tools vs. product/data builds)  
Expected improvement: demonstrate sales‑specific prototyping capability

## What Worked / What Didn't
Built a 16KB single HTML file with Tailwind CDN + vanilla JS. Live scoring simulation updates every 10 seconds. Pipeline projection uses real conversion rates from swim coach sales data. The challenge was compressing three sales functions (scoring, sequences, projections) into one coherent dashboard without overcrowding. Solution: left‑right split (scoring + projections on left, sequences on right) with pipeline stages below. Key insight: sales tools must speak coach language — team size, retention, “transforms your athletes” positioning. Future builds should test A/B variants: one with CRM integration, another with mobile‑first poolside design.