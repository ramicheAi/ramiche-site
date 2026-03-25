# FD: METTLE Heat Sheet Generator

**Status:** Complete
**Owner:** Nova
**Created:** 2026-03-21 01:00
**Lane:** Product prototypes

## Objective
Interactive heat sheet generator — coaches enter swimmers with seed times, select seeding mode (circle/straight/random), and generate printable heat cards with proper center-out lane assignments.

## Acceptance Criteria
- [x] Meet setup with name, date, venue, pool length, lane count, gender
- [x] 4 event templates (dual, championship, sprint, distance)
- [x] Entry management with add/remove per swimmer per event
- [x] Sample data generation (20 swimmers, realistic seed times)
- [x] Circle seeding (USA Swimming standard — fastest in last heat, center lanes)
- [x] Straight seeding and random seeding modes
- [x] Printable heat cards with B&W print stylesheet
- [x] Text export for offline use

## A/B Context
Previous build this improves on: METTLE Practice Builder (2026-03-20)
Variable changed: Shifts from pre-practice workflow to pre-meet workflow
Expected improvement: Higher evaluation score — meet-day tools scored 104/110 in prior eval vs practice tools at 105/110

## What Worked / What Didn't
Circle seeding algorithm required careful center-out lane mapping — the key insight is building the lane priority order first (center lane, then alternating outward), then distributing swimmers across heats in reverse order (last heat filled first). The sample data generator uses age/gender adjustment factors on real seed time ranges to produce believable entry lists. Print stylesheet is critical for poolside use where coaches need paper copies.
