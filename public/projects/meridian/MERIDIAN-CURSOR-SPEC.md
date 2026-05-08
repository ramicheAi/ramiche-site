# MERIDIAN — Cursor Implementation Specification

> **Drop this file into Cursor with the repo root open. Build in exact order. Each section is a self-contained work package.**
>
> Source: MERIDIAN Functional Spec v1.0 (SIMONS) + PDF Summary. March 27, 2026.
> Existing prototype: 34 modules in `/Users/admin/.openclaw/workspace-simons/data/` — refactor into this structure, don't rewrite from scratch.

---

## 0. Project Bootstrap

```bash
# Clone the empty repo
git clone git@github.com:ramicheAi/meridian.git ~/meridian
cd ~/meridian

# Create structure
mkdir -p config core cli signals portfolio risk selfaware dashboard \
  data/{raw,signals,portfolio,risk,selfaware,checkpoints} \
  journal backtest logs tests/{unit,integration,system}

# Virtual environment
python3 -m venv .venv && source .venv/bin/activate

# Dependencies
pip install numpy pandas scipy scikit-learn hmmlearn textblob yfinance \
  pyyaml click rich pytest pytest-benchmark
pip freeze > requirements.txt
```

### `pyproject.toml`
```toml
[project]
name = "meridian"
version = "1.0.0"
description = "Self-aware quantitative trading operating system"
requires-python = ">=3.10"
dependencies = [
    "numpy", "pandas", "scipy", "scikit-learn", "hmmlearn",
    "textblob", "yfinance", "pyyaml", "click", "rich",
    "backtesting"
]

[project.scripts]
meridian = "cli.main:cli"
```

---

## 1. Core Infrastructure (Sprint 1)

### 1A. Config Loader — `config/loader.py`
**Migrate from:** `workspace-simons/data/meridian_config.yaml` (if exists) or create fresh.

Load + validate `meridian_config.yaml`. Single source of truth.

| Section | Key | Default | Range |
|---------|-----|---------|-------|
| universe.tickers | list | [SPY,QQQ,AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,AMD] | strings |
| universe.max_tickers | int | 50 | 1–200 |
| signals.buy_threshold | int | +30 | -100 to +100 |
| signals.sell_threshold | int | -30 | -100 to +100 |
| signals.weights.regime | float | 0.18 | 0.02–0.30 |
| signals.weights.trend | float | 0.14 | 0.02–0.30 |
| signals.weights.mean_reversion | float | 0.14 | 0.02–0.30 |
| signals.weights.momentum | float | 0.10 | 0.02–0.30 |
| signals.weights.volume | float | 0.06 | 0.02–0.30 |
| signals.weights.sentiment | float | 0.08 | 0.02–0.30 |
| signals.weights.fundamental | float | 0.08 | 0.02–0.30 |
| signals.weights.valuation | float | 0.12 | 0.02–0.30 |
| signals.weights.macro | float | 0.10 | 0.02–0.30 |
| portfolio.blend_ratio | float | 0.70 | 0.0–1.0 |
| portfolio.max_position | float | 0.15 | 0.01–0.50 |
| portfolio.exits.hard_stop | float | -0.08 | -0.50 to 0 |
| portfolio.exits.trailing_stop | float | -0.12 | -0.50 to 0 |
| portfolio.exits.max_holding_days | int | 60 | 1–252 |
| risk.correlation_warn | float | 0.4 | 0.0–1.0 |
| risk.correlation_critical | float | 0.6 | 0.0–1.0 |
| risk.drawdown.warning_pct | float | -0.10 | -0.50 to 0 |
| risk.drawdown.danger_pct | float | -0.15 | -0.50 to 0 |
| risk.drawdown.critical_pct | float | -0.20 | -0.50 to 0 |
| selfaware.ic_decay_threshold | float | 0.02 | 0.0–0.10 |
| selfaware.hitrate_decay_threshold | float | 0.48 | 0.40–0.55 |
| selfaware.decay_lookback_days | int | 60 | 20–252 |
| selfaware.weight_rebalance_freq | int | 5 | 1–20 |
| selfaware.ab_test.min_days | int | 20 | 10–60 |
| selfaware.ab_test.significance | float | 0.05 | 0.01–0.10 |
| schedule.run_times | list | [09:35, 16:05] | HH:MM |
| schedule.timezone | str | America/New_York | TZ string |

**Validation:** Weights must sum to 1.0 (±0.01). All ranges enforced. Missing keys → defaults.

### 1B. Data Fetcher — `data/fetcher.py`
**Migrate from:** parts of `workspace-simons/data/daily_signals.py`, `watchlist_scanner.py`

```python
class DataSource(ABC):
    """Abstract adapter — swap yfinance for other providers later."""
    def fetch_ohlcv(self, tickers, lookback_days) -> dict[str, pd.DataFrame]: ...
    def fetch_fundamentals(self, tickers) -> dict[str, dict]: ...

class YFinanceSource(DataSource):
    """Default implementation using yfinance."""
```

- Cache raw data to `data/raw/YYYY-MM-DD.json`
- Retry 3× with exponential backoff on API failure
- Use cached data if API fails after retries
- Log all fetch operations

### 1C. Pipeline Runner — `core/pipeline.py`
**Migrate from:** `workspace-simons/data/run_cycle.py`

13-step sequential pipeline with checkpointing:

1. Data Fetcher → raw market data
2. Signal Components (×10) → individual scores per ticker
3. Signal Combiner → composite scores + actions
4. Portfolio Optimizer → optimal weights
5. Position Sizer → final position sizes + orders
6. Risk Monitors (×7) → risk states, alerts, overrides
7. Risk Override Applier → risk-adjusted positions
8. Signal Decay Monitor → component health scores
9. Adaptive Weights → updated weights for next run
10. A/B Tester → comparison metrics
11. Performance Attribution → P&L decomposition
12. Auto-Journal → timestamped, checksummed entry
13. Dashboard Aggregator → unified JSON

**Requirements:**
- Checkpoint JSON after each step to `data/checkpoints/`
- Resume from last checkpoint on crash
- Total execution < 120 seconds for 50 tickers
- Log step timing to `logs/`

### 1D. CLI Skeleton — `cli/main.py`
Click-based CLI. Pattern: `meridian <command> [options]`

| Command | Description |
|---------|-------------|
| `meridian init` | Initialize directory structure + default config + quick 30-day backtest |
| `meridian run` | Execute full 13-step pipeline |
| `meridian status` | Formatted dashboard summary (rich tables) |
| `meridian signals` | Signal scores and actions per ticker |
| `meridian portfolio` | Portfolio state (positions, weights, exposure) |
| `meridian risk` | Risk monitor states (color-coded) |
| `meridian health` | Signal component health (IC, hit rate, decay flags) |
| `meridian ab` | Manage A/B tests (start/stop/status/compare) |
| `meridian journal` | Search journal entries (by date/ticker/event) |
| `meridian backtest` | Run historical backtest |
| `meridian config` | Display/validate config |
| `meridian cron` | Install/remove/status scheduling |

Use `rich` for terminal formatting (tables, colors, progress bars, sparklines).

---

## 2. Layer 1: Signal Generation (Sprint 2)

### Architecture — Base Class

```python
class SignalComponent:
    """Base class for all 10 signal components."""

    def score(self, ticker: str, data: pd.DataFrame, fundamentals: dict | None = None) -> dict:
        """
        Returns {
            "score": float,       # -100 to +100
            "confidence": float,  # 0.0 to 1.0
            "metadata": dict      # component-specific
        }
        """
        raise NotImplementedError

    def handle_missing_data(self) -> dict:
        """Neutral fallback: {score: 0, confidence: 0, metadata: {error: "missing_data"}}"""
```

### 2A. SC-01 Regime Detector — `signals/regime.py` (Weight: 18%)
**Migrate from:** `workspace-simons/data/regime_detector.py`

- Input: 252 days price history, returns, volatility
- Method: 3-state HMM (Bull/Bear/Sideways) via `hmmlearn.GaussianHMM`
- Features: log returns, 20-day realized vol, 50-day rolling return
- Output: regime label, transition probability matrix, score
- Scoring: Bull → +80, Sideways → 0, Bear → -80 (scaled by transition probability)

### 2B. SC-02 Trend Following — `signals/trend.py` (Weight: 14%)
**Migrate from:** parts of `workspace-simons/data/daily_signals.py`

- Input: price, MA(20/50/200), ADX(14)
- Method: MA crossover signals + ADX strength + trend persistence
- Golden cross (MA20 > MA50 > MA200) + ADX > 25 → +100
- Death cross + strong downtrend → -100

### 2C. SC-03 Mean Reversion — `signals/reversion.py` (Weight: 14%)
**Migrate from:** parts of `workspace-simons/data/daily_signals.py`

- Input: price, RSI(14), Bollinger Bands(20,2), z-score from 20-day rolling mean
- RSI < 30 + below lower BB → +100 (deeply oversold)
- RSI > 70 + above upper BB → -100 (overbought)

### 2D. SC-04 Momentum — `signals/momentum.py` (Weight: 10%)
**Migrate from:** parts of `workspace-simons/data/daily_signals.py`

- Input: returns (5d/10d/20d/60d), Rate of Change
- Multi-timeframe momentum scoring, acceleration detection
- Weighted average across timeframes

### 2E. SC-05 Volume Analysis — `signals/volume.py` (Weight: 6%)
**Migrate from:** parts of `workspace-simons/data/daily_signals.py`

- Input: volume, price, OBV, Accumulation/Distribution line
- Volume-price divergence detection
- Bullish divergence → positive, bearish → negative

### 2F. SC-06 Sentiment — `signals/sentiment.py` (Weight: 8%)
**New module** (prototype had basic version)

- Input: news headlines via RSS/API (configurable)
- Method: TextBlob polarity aggregation, 3-day lookback
- Score = average polarity × 100
- Upgradeable to FinBERT in Phase 2

### 2G. SC-07 Fundamental — `signals/fundamental.py` (Weight: 8%)
**Migrate from:** `workspace-simons/data/fundamental_scorer.py`

- Input: EPS growth, PEG, revenue growth, D/E ratio, margins
- Multi-factor quality scoring (each factor 0-20, sum normalized to -100/+100)

### 2H. SC-08 Valuation — `signals/valuation.py` (Weight: 12%)
**Migrate from:** `workspace-simons/data/valuation_scorer.py`

- Input: P/E, P/B, EV/EBITDA, sector comparables
- Relative valuation vs sector peers + DCF margin of safety
- Undervalued → positive, overvalued → negative

### 2I. SC-09 Macro Overlay — `signals/macro.py` (Weight: 10%)
**Migrate from:** `workspace-simons/data/macro_scorer.py`

- Input: VIX, yield curve (10Y-2Y spread), market breadth, DXY, credit spreads
- Multi-indicator macro environment scoring

### 2J. SC-10 Options Flow — `signals/options.py` (Weight: Bonus/Additive)
**Migrate from:** `workspace-simons/data/options_flow.py`

- Input: put/call ratios, unusual volume, implied vol skew
- Z-score anomaly detection (> 2σ from 20-day mean)
- **Additive bonus** to composite — not part of the 100% weighted ensemble

### 2K. Signal Combiner — `signals/combiner.py`
**Migrate from:** `workspace-simons/data/composite_scorer.py`

**Formula:** `composite = Σ(score[i] × weight[i]) + options_bonus`
Normalized to -100 to +100 range.

**Action mapping:**
- BUY if composite > +30 (configurable `signals.buy_threshold`)
- SELL if composite < -30 (configurable `signals.sell_threshold`)
- HOLD otherwise
- Confidence = |composite| / 100

**Output contract per ticker:**
```json
{
    "ticker": "AAPL",
    "composite_score": 45.2,
    "action": "BUY",
    "confidence": 0.452,
    "component_scores": {
        "regime": 80, "trend": 55, "mean_reversion": -10,
        "momentum": 30, "volume": 15, "sentiment": 20,
        "fundamental": 40, "valuation": 35, "macro": 25
    },
    "options_bonus": 5,
    "regime_state": "Bull",
    "timestamp": "2026-03-27T09:35:00-04:00"
}
```

---

## 3. Layer 2: Portfolio Intelligence (Sprint 3)

### 3A. Mean-Variance Optimizer — `portfolio/optimizer.py`
**Migrate from:** `workspace-simons/data/portfolio_optimizer.py`, `efficient_frontier.py`

- Markowitz optimization with Ledoit-Wolf covariance shrinkage (sklearn)
- Input: expected returns (from composite signals), covariance matrix
- Output: optimal weight vector
- Constraint: all weights ≥ 0 (long-only), sum = 1.0
- **Fallback:** equal-weight if solver fails

### 3B. Position Sizer — `portfolio/sizer.py`
**Migrate from:** parts of `workspace-simons/data/portfolio_optimizer.py`

- Half-Kelly: `f* = 0.5 × (win_rate - (1 - win_rate) / avg_win_loss_ratio)`
- Cap max single position at 15% (configurable `portfolio.max_position`)
- 70/30 blend: `final_weight = 0.7 × signal_weight + 0.3 × optimizer_weight`

### 3C. Regime Exposure — `portfolio/exposure.py`
**Migrate from:** parts of `workspace-simons/data/regime_detector.py`

- Scale total portfolio exposure by regime:
  - Bull: up to 100%
  - Sideways: cap at 70%
  - Bear: cap at 40%
- Linear interpolation during transitions using HMM transition probabilities

### 3D. Exit Rules — `portfolio/exits.py`
**Migrate from:** `workspace-simons/data/exit_rules.py`

Four independent triggers (most restrictive wins):
1. **Hard Stop:** fixed % loss from entry (default -8%)
2. **Trailing Stop:** % from peak (default -12%)
3. **Time Exit:** max holding period (default 60 trading days)
4. **Earnings Proximity:** flatten 2 days before earnings unless confidence > 0.7

**Output per ticker:**
```json
{
    "ticker": "AAPL",
    "action": "BUY",
    "target_weight": 0.08,
    "shares": 45,
    "dollar_amount": 8000,
    "rationale": "Composite +45.2, regime Bull, optimizer weight 0.06"
}
```

---

## 4. Layer 3: Risk Management (Sprint 4)

**Core principle:** Risk overrides ALL other layers. Always.

### 4A. RM-01 Correlation Monitor — `risk/correlation.py`
**Migrate from:** `workspace-simons/data/correlation_monitor.py`

- 20-day rolling pairwise correlation
- YELLOW (>0.4): warn + log
- RED (>0.6): block new correlated positions

### 4B. RM-02 Drawdown Circuit Breaker — `risk/drawdown.py`
**Migrate from:** `workspace-simons/data/drawdown_breaker.py`

Three tiers:
- WARNING (-10%): halve new position sizes
- DANGER (-15%): halt all new trades
- CRITICAL (-20%): flatten everything to cash

### 4C. RM-03 Volatility Model — `risk/volatility.py`
**Migrate from:** `workspace-simons/data/volatility_model.py`

- Realized vol: 20d, 5d, Parkinson range estimator
- Vol-of-vol for regime detection
- Dynamic sizing multiplier: Low=1.2×, Normal=1.0×, High=0.6×, Extreme=0.35×

### 4D. RM-04 Sector Rotation — `risk/sectors.py`
**Migrate from:** `workspace-simons/data/sector_rotation.py`

- 11-sector relative strength (20d/60d)
- Quadrant mapping: Leading / Improving / Lagging / Weakening
- Block overweight in Lagging sectors

### 4E. RM-05 Stress Tester — `risk/stress.py`
**Migrate from:** `workspace-simons/data/stress_tester.py`

- Simulate portfolio against 4 historical crises: 2008 GFC, 2020 COVID, 2022 rate shock, stagflation
- Report: max drawdown, time-to-recovery, survival probability per scenario

### 4F. RM-06 Concentration Monitor — `risk/concentration.py`
**New module** (logic was inline in prototype)

- Flag: single position > 15% or top-3 > 40%

### 4G. RM-07 Liquidity Monitor — `risk/liquidity.py`
**New module**

- Flag: allocation > 1% of 20-day average daily volume

### 4H. Risk Override Applier — `risk/overrides.py`
**Migrate from:** parts of `workspace-simons/data/run_cycle.py`

- Applies ALL risk monitor outputs to position sizes
- Risk ALWAYS overrides signal/portfolio recommendations
- Circuit breaker = DANGER → no new trades regardless of signal strength

---

## 5. Layer 4: Self-Awareness — Core Differentiator (Sprint 5)

**This is MERIDIAN's killer feature.** No competing product offers this to independent traders.

### 5A. SA-01 Signal Decay Monitor — `selfaware/decay.py`
**Migrate from:** `workspace-simons/data/signal_decay_monitor.py`

- Track IC (Information Coefficient) and hit rate per component
- Rolling window: 60 trading days (configurable)
- Decay flag: IC < 0.02 OR hit rate < 48%
- On decay: reduce weight by 50%, redistribute proportionally to healthy components

### 5B. SA-02 A/B Testing Framework — `selfaware/ab_test.py`
**Migrate from:** `workspace-simons/data/ab_test.py`

- Run 2 strategy configs on equal virtual capital simultaneously
- Track daily equity curves, compute alpha (return difference)
- t-test for statistical significance
- Winner declared at p < 0.05 with minimum 20 trading days
- Output: daily comparison JSON with equity curves, alpha, p-value, recommendation

### 5C. SA-03 Adaptive Weights — `selfaware/weights.py`
**Migrate from:** `workspace-simons/data/adaptive_weights.py`

- Weekly rebalance (every 5 trading days)
- Higher recent IC / hit rate → increased weight
- Bounds: min 2%, max 30% per component
- Weights always sum to 100%
- Log every adjustment to journal

### 5D. SA-04 Performance Attribution — `selfaware/attribution.py`
**Migrate from:** `workspace-simons/data/performance_attribution.py`

- Decompose P&L per trade:
  - Which signal component drove the entry?
  - Which regime call informed the sizing?
  - Which exit rule triggered the close?
- Per-trade and per-period attribution JSON

### 5E. SA-05 Auto Journal — `selfaware/journal.py`
**Migrate from:** `workspace-simons/data/daily_journal.py`

- Log every event: trade, signal run, regime change, weight adjustment, risk override, A/B update
- SHA-256 checksum per entry (immutable audit trail)
- Append-only JSONL format
- One file per month: `journal/YYYY-MM.jsonl`
- Searchable by: date, ticker, event_type, component

---

## 6. Layer 5: Dashboard & API (Sprint 6)

### 6A. Dashboard Aggregator — `dashboard/aggregator.py`
**Migrate from:** `workspace-simons/data/dashboard_api.py`, `dashboard_data.py`

Assemble all pipeline outputs into single JSON (17 sections):

```json
{
    "schema_version": "1.0",
    "generated_at": "2026-03-27T09:35:00-04:00",
    "portfolio_state": {},
    "signals": {},
    "signal_decomposition": {},
    "regime_state": {},
    "optimizer_output": {},
    "position_sizing": {},
    "risk_dashboard": {},
    "correlation_matrix": {},
    "drawdown_status": {},
    "volatility_regime": {},
    "sector_rotation": {},
    "stress_test_results": {},
    "signal_health": {},
    "ab_test_status": {},
    "weight_history": {},
    "performance_attribution": {},
    "journal_recent": []
}
```

- Max 200KB for 50-ticker universe
- Write to `dashboard/dashboard_api.json` (latest) + `dashboard/YYYY-MM-DD-HHMMSS.json` (snapshot)

### 6B. CLI Renderer — `dashboard/cli_render.py`
- `rich` tables for signal scores, portfolio state, risk status
- Color-coded risk levels (green/yellow/red)
- Sparkline for equity curve
- Progress bars for component health

### 6C. API Server (Optional) — `dashboard/server.py`
- Simple HTTP server serving `dashboard_api.json`
- For RAMICHE OS Command Center integration (Next.js)
- CORS-enabled for local dev

---

## 7. Module Migration Map

| New Path | Migrate From (workspace-simons/data/) | Notes |
|----------|---------------------------------------|-------|
| `config/loader.py` | New | YAML loader + validator |
| `data/fetcher.py` | `daily_signals.py` (data fetch parts) | Add adapter pattern |
| `core/pipeline.py` | `run_cycle.py` | Add checkpointing |
| `signals/regime.py` | `regime_detector.py` | Clean interface |
| `signals/trend.py` | `daily_signals.py` (trend parts) | Extract to standalone |
| `signals/reversion.py` | `daily_signals.py` (reversion parts) | Extract to standalone |
| `signals/momentum.py` | `daily_signals.py` (momentum parts) | Extract to standalone |
| `signals/volume.py` | `daily_signals.py` (volume parts) | Extract to standalone |
| `signals/sentiment.py` | New (basic in prototype) | TextBlob NLP |
| `signals/fundamental.py` | `fundamental_scorer.py` | Clean interface |
| `signals/valuation.py` | `valuation_scorer.py` | Clean interface |
| `signals/macro.py` | `macro_scorer.py` | Clean interface |
| `signals/options.py` | `options_flow.py` | Additive bonus |
| `signals/combiner.py` | `composite_scorer.py` | Weighted ensemble |
| `portfolio/optimizer.py` | `portfolio_optimizer.py` + `efficient_frontier.py` | Merge |
| `portfolio/sizer.py` | `portfolio_optimizer.py` (sizing parts) | Extract |
| `portfolio/exposure.py` | `regime_detector.py` (exposure parts) | Extract |
| `portfolio/exits.py` | `exit_rules.py` | Clean interface |
| `risk/correlation.py` | `correlation_monitor.py` | Direct port |
| `risk/drawdown.py` | `drawdown_breaker.py` | Direct port |
| `risk/volatility.py` | `volatility_model.py` | Direct port |
| `risk/sectors.py` | `sector_rotation.py` | Direct port |
| `risk/stress.py` | `stress_tester.py` | Direct port |
| `risk/concentration.py` | New (was inline) | Extract |
| `risk/liquidity.py` | New | ADV constraints |
| `risk/overrides.py` | `run_cycle.py` (override parts) | Extract |
| `selfaware/decay.py` | `signal_decay_monitor.py` | Direct port |
| `selfaware/ab_test.py` | `ab_test.py` | Direct port |
| `selfaware/weights.py` | `adaptive_weights.py` | Direct port |
| `selfaware/attribution.py` | `performance_attribution.py` | Direct port |
| `selfaware/journal.py` | `daily_journal.py` | JSONL format |
| `dashboard/aggregator.py` | `dashboard_api.py` + `dashboard_data.py` | Merge |
| `dashboard/cli_render.py` | New | Rich terminal UI |
| `dashboard/server.py` | New | Optional HTTP |
| `cli/main.py` | New | Click CLI |

**Also migrate:**
- `workspace-simons/backtesting/engine.py` → `backtest/engine.py`
- `workspace-simons/data/paper_trader.py` → `core/paper_trader.py`
- `workspace-simons/data/market_timing.py` → `signals/timing.py` (utility)
- `workspace-simons/data/confidence_index.py` → `core/confidence.py`
- `workspace-simons/data/earnings_filter.py` → `portfolio/earnings.py`
- `workspace-simons/data/watchlist_scanner.py` → `core/scanner.py`
- `workspace-simons/data/watchlist_expander.py` → `core/expander.py`
- `workspace-simons/data/weekly_report.py` → `dashboard/weekly_report.py`

---

## 8. File System Layout

```
~/meridian/
├── config/
│   ├── meridian_config.yaml    # All parameters (single source of truth)
│   └── tickers.txt             # Ticker universe
├── core/
│   ├── pipeline.py             # 13-step orchestrator with checkpoints
│   ├── paper_trader.py         # Paper trading engine
│   ├── confidence.py           # Confidence index
│   ├── scanner.py              # Watchlist scanner
│   └── expander.py             # Watchlist expander
├── cli/
│   └── main.py                 # Click CLI (12 commands)
├── signals/
│   ├── base.py                 # SignalComponent ABC
│   ├── regime.py               # SC-01: HMM regime (18%)
│   ├── trend.py                # SC-02: Trend following (14%)
│   ├── reversion.py            # SC-03: Mean reversion (14%)
│   ├── momentum.py             # SC-04: Momentum (10%)
│   ├── volume.py               # SC-05: Volume analysis (6%)
│   ├── sentiment.py            # SC-06: Sentiment NLP (8%)
│   ├── fundamental.py          # SC-07: Fundamentals (8%)
│   ├── valuation.py            # SC-08: Valuation (12%)
│   ├── macro.py                # SC-09: Macro overlay (10%)
│   ├── options.py              # SC-10: Options flow (bonus)
│   └── combiner.py             # Weighted ensemble
├── portfolio/
│   ├── optimizer.py            # Mean-variance + Ledoit-Wolf
│   ├── sizer.py                # Half-Kelly + 70/30 blend
│   ├── exposure.py             # Regime-adaptive exposure caps
│   ├── exits.py                # 4 exit rule types
│   └── earnings.py             # Earnings proximity filter
├── risk/
│   ├── correlation.py          # RM-01: Pairwise correlation
│   ├── drawdown.py             # RM-02: 3-tier circuit breaker
│   ├── volatility.py           # RM-03: Vol regime + multiplier
│   ├── sectors.py              # RM-04: 11-sector rotation
│   ├── stress.py               # RM-05: Crisis simulation
│   ├── concentration.py        # RM-06: Position limits
│   ├── liquidity.py            # RM-07: ADV constraints
│   └── overrides.py            # Risk override applier
├── selfaware/
│   ├── decay.py                # SA-01: Signal decay monitor
│   ├── ab_test.py              # SA-02: A/B testing framework
│   ├── weights.py              # SA-03: Adaptive weights
│   ├── attribution.py          # SA-04: P&L decomposition
│   └── journal.py              # SA-05: Auto-journal (JSONL)
├── dashboard/
│   ├── aggregator.py           # 17-section JSON assembly
│   ├── cli_render.py           # Rich terminal formatting
│   ├── server.py               # Optional HTTP server
│   └── weekly_report.py        # Weekly performance report
├── backtest/
│   └── engine.py               # Historical backtesting
├── data/
│   ├── fetcher.py              # Market data fetcher (adapter pattern)
│   ├── raw/                    # Market data cache (rolling 2yr)
│   ├── signals/                # Signal outputs per run (1yr)
│   ├── portfolio/              # Portfolio states (permanent)
│   ├── risk/                   # Risk monitor outputs (1yr)
│   ├── selfaware/              # Signal health, A/B, weights (permanent)
│   └── checkpoints/            # Pipeline checkpoints
├── journal/                    # Append-only JSONL (permanent)
├── logs/                       # Execution logs (30 days)
└── tests/
    ├── unit/                   # pytest unit tests (>80% coverage)
    ├── integration/            # Module-to-module data flow
    └── system/                 # Full pipeline e2e
```

---

## 9. Non-Functional Requirements

| ID | Category | Target |
|----|----------|--------|
| NFR-001 | Performance | Full pipeline < 120s (50 tickers, M-series Mac) |
| NFR-002 | Performance | Signal gen (Layer 1) < 60s (50 tickers) |
| NFR-003 | Reliability | Retry 3× with exponential backoff; use cached on failure |
| NFR-004 | Reliability | Checkpoint after each layer; resume on crash |
| NFR-005 | Storage | < 500MB for 1 year of 50-ticker data |
| NFR-006 | Security | No outbound except yfinance API; local-first |
| NFR-007 | Portability | macOS (ARM), Ubuntu 24, Windows WSL2 |
| NFR-008 | Testing | Unit tests >80% coverage (pytest) |
| NFR-009 | Config | Single YAML config with documented defaults |
| NFR-010 | Extensibility | Plugin interface for custom signal components |

---

## 10. Implementation Order

**Build in this exact sequence. Each step depends on the previous.**

1. `config/loader.py` + `config/meridian_config.yaml`
2. `data/fetcher.py` (with DataSource adapter interface)
3. `core/pipeline.py` (skeleton — steps 1-3 first)
4. `signals/base.py` → `signals/regime.py` → all 10 components → `signals/combiner.py`
5. `portfolio/optimizer.py` → `sizer.py` → `exposure.py` → `exits.py`
6. `risk/` (all 8 files — correlation through overrides)
7. `selfaware/` (all 5 files — decay through journal)
8. `dashboard/aggregator.py` → `cli_render.py`
9. `cli/main.py` (wire all 12 commands)
10. Tests: unit → integration → system

---

## 11. Architecture Decisions (Pre-Resolved)

| # | Decision | Answer |
|---|----------|--------|
| Q-01 | Abstract yfinance behind adapter? | **Yes** — adds minimal code, de-risks provider swap |
| Q-02 | A/B test >2 strategies? | **No** — 2-way Phase 1, multi-arm Phase 3 |
| Q-03 | Min paper trading before real capital? | **90 days** |
| Q-04 | Journal format? | **JSONL** Phase 1, SQLite Phase 2 |
| Q-05 | RAMICHE OS integration? | **Yes** — health → TRIAGE, alerts → Atlas |
| Q-06 | License? | **Apache 2.0** — permissive + patent protection |
| Q-07 | Backtest-on-install? | **Yes** — `meridian init` runs quick 30-day backtest |

---

## 12. Prototype Performance Baseline

From SIMONS' 4-day prototype (34 modules, ~6,000 LOC):
- Paper portfolio: **+28.78%** (8 trading days)
- A/B alpha vs buy & hold: **+13.41%**
- Win rate: **60%**
- Max drawdown: **0.21%**
- Sharpe ratio: **2.81**
- Avg pairwise correlation: **0.18** (GREEN)
- Infrastructure cost: **$0**

Target: match or exceed these metrics after restructuring.

---

## 13. Failure Handling

| Failure Type | Response |
|-------------|----------|
| Data fetch failure | Skip cycle, log error, use cached data |
| Signal component failure | Zero weight that component, redistribute |
| Risk breach | Reduce exposure or halt trading |
| System crash | Restart from last checkpoint |
| Config error | Fail fast with clear error message |

---

## 14. Future Phases (Architecture Hooks Required Now)

- **Phase 2:** FinBERT sentiment, SQLite journal, real broker integration
- **Phase 3:** Multi-arm A/B testing, ML signal components, alternative data
- **Phase 4:** Web dashboard, mobile alerts, multi-user support

Design Phase 1 modules with clean interfaces that don't need rewriting for these extensions.

---

*Generated from MERIDIAN Functional Spec v1.0 (SIMONS/RAMICHE OS, March 27, 2026). Combines PDF summary + full DOCX specification. Ready for Cursor implementation.*
