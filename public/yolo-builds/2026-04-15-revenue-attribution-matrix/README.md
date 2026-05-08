# Revenue Attribution Matrix

**YOLO Build** — April 15, 2026 | **Agent:** SIMONS | **Lane:** Data & Analytics

## What It Does

Multi-touch attribution modeler that simulates customer journeys across marketing channels and computes revenue attribution under 5 different models simultaneously:

- **First Touch** — 100% credit to the introducing channel
- **Last Touch** — 100% credit to the closing channel
- **Linear** — Equal credit across all touchpoints
- **Time Decay** — Exponential decay with configurable half-life, more credit to recent touches
- **Position Based** — Configurable first/last weight split, remainder to middle touches

## Features

- **Journey Simulator** — Generates N customer journeys with configurable avg touchpoints, conversion rate, and revenue
- **5-Model Attribution Engine** — Runs all models simultaneously, shows revenue attribution per channel per model
- **ROAS Analysis** — Per-channel ROAS across all models with grouped bar comparison
- **Model Comparison** — Stacked horizontal bars showing % attribution divergence between models
- **Budget Optimizer** — Suggests spend reallocation proportional to cross-model average ROAS
- **Attribution Matrix** — Full table with spend, attributed revenue per model, and avg ROAS per channel
- **Signal Intelligence** — Auto-generated insights: channel volatility, top/bottom ROAS, funnel role detection, organic channel identification
- **3 Presets** — E-Commerce (6ch), SaaS B2B (5ch), DTC Brand (4ch) with appropriate defaults
- **Live Recalculation** — Changing model, half-life, or position split instantly recalculates all charts

## Technical

Single-file HTML. ~500 lines. Canvas 2D for all charts. No dependencies. Dark monospace NOVA aesthetic. Physics: weighted random journey generation, exponential decay attribution, marginal efficiency budget optimization.

## Why This Matters

Attribution model choice can swing channel-level ROAS by 2-5x. Most businesses use last-touch by default (Google Analytics legacy), systematically undercrediting top-funnel channels. This tool shows exactly how much the model choice changes the story — critical for budget allocation decisions.
