# FD: SpoolTracker Inventory App

**Status:** Complete
**Owner:** NOVA
**Created:** 2026-03-17 01:10
**Lane:** Product prototypes

## Objective
A lightweight local inventory tracker for filament spools to prevent starting prints with insufficient material.

## Acceptance Criteria
- [x] Create spool with brand, type, and color
- [x] Visualize remaining filament with progress bar
- [x] Add/subtract remaining material by weight (grams)
- [x] Persist data locally (localStorage)

## A/B Context
Previous build this improves on: none
Variable changed: visual inventory management
Expected improvement: tracking accuracy and reduced failed prints due to runouts

## What Worked / What Didn't
Using a simple single-file HTML approach with localStorage works perfectly for a quick prototype. Next step would be bridging this to the Bambu Lab MQTT stream so it automatically deducts grams based on print history, rather than requiring manual button clicks.