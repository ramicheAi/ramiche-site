# MERIDIAN — Cursor Implementation Document

> Drop this into Cursor with the repo root open. Each section is a self-contained work package.

---

## 0. Project Setup

```bash
# Create repo structure
mkdir -p meridian/{config,core,signals,portfolio,risk,selfaware,dashboard,data/{raw,signals,portfolio,risk,selfaware},journal,backtest,logs,tests/{unit,integration,system}}

# Create virtual environment
cd meridian
python3 -m venv .venv && source .venv/bin/activate

# Install dependencies
pip install numpy pandas scipy scikit-learn hmmlearn textblob yfinance pyyaml click rich pytest pytest-benchmark backtesting
pip freeze > requirements.txt
```

### File: `pyproject.toml`
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

**Purpose:** Load + validate `meridian_config.yaml`. Single source of truth for all parameters.

**Contract:**
- Input: path to YAML file (default: `~/meridian/config/meridian_config.yaml`)
- Output: validated Python dict with all parameters
- Raises `ConfigError` on invalid values

**Key parameters with defaults:**

| Section | Key | Default | Range |
|---------|-----|---------|-------|
| universe.tickers | list | [SPY,QQQ,AAPL...] | strings |
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

**Validation rules:** Weights must sum to 1.0 (±0.01). All ranges enforced. Missing keys get defaults.

### 1B. Data Fetcher — `data/fetcher.py`

**Purpose:** Fetch OHLCV + fundamental data via yfinance. Cache locally.

**Contract:**
```python
def fetch_market_data(tickers: list[str], lookback_days: int = 252) -> dict[str, pd.DataFrame]:
    """Returns {ticker: DataFrame with columns [Open,High,Low,Close,Volume]}"""

def fetch_fundamentals(tickers: list[str]) -> dict[str, dict]:
    """Returns {ticker: {pe, pb, ev_ebitda, eps_growth, revenue_growth, debt_equity, margins}}"""
```

**Requirements:**
- Cache raw data to `data/raw/YYYY-MM-DD.json`
- Retry 3x with exponential backoff on API failure
- Use cached data if API fails after retries
- Abstract behind `DataSource` interface (adapter pattern for future providers)
- Log all fetch operations

### 1C. Pipeline Runner — `core/pipeline.py`

**Purpose:** Orchestrate the 13-step sequential pipeline with checkpointing.

**13 Steps:**
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
- Log step timing

### 1D. CLI Skeleton — `cli/main.py`

**Purpose:** Click-based CLI. Pattern: `meridian <command> [options]`

**Commands:**
| Command | Description |
|---------|-------------|
| `meridian init` | Initialize directory structure + config |
| `meridian run` | Execute full 13-step pipeline |
| `meridian status` | Print formatted dashboard summary |
| `meridian signals` | Display signal scores and actions |
| `meridian portfolio` | Show portfolio state |
| `meridian risk` | Display risk monitor states |
| `meridian health` | Show signal component health |
| `meridian ab` | Manage A/B tests |
| `meridian journal` | Search journal entries |
| `meridian backtest` | Run historical backtest |
| `meridian config` | Display/validate config |
| `meridian cron` | Install/remove/status scheduling |

Use `rich` for terminal formatting (tables, colors, progress bars).

---

## 2. Layer 1: Signal Generation (Sprint 2)

### Architecture

10 independent signal components, each implementing:

```python
class SignalComponent:
    """Base class for all signal components."""

    def score(self, ticker: str, data: pd.DataFrame, fundamentals: dict | None = None) -> dict:
        """
        Returns {
            "score": float,       # -100 to +100
            "confidence": float,  # 0.0 to 1.0
            "metadata": dict      # component-specific data
        }
        """
        raise NotImplementedError

    def handle_missing_data(self) -> dict:
        """Returns neutral score {score: 0, confidence: 0, metadata: {error: "missing_data"}}"""
```

### 2A. SC-01 Regime Detector — `signals/regime.py` (Weight: 18%)

- Input: 252 days of price history, returns, volatility
- Method: 3-state Hidden Markov Model (Bull/Bear/Sideways) via `hmmlearn`
- Output: regime label, transition probability matrix, score (-100 to +100)
- Bull → +80, Sideways → 0, Bear → -80 (scaled by transition probability)

### 2B. SC-02 Trend Following — `signals/trend.py` (Weight: 14%)

- Input: price, MA(20/50/200), ADX(14)
- Method: MA crossover signals + ADX strength + trend persistence
- Scoring: +100 (golden cross + ADX>25 + uptrend), -100 (death cross + strong downtrend)

### 2C. SC-03 Mean Reversion — `signals/reversion.py` (Weight: 14%)

- Input: price, RSI(14), Bollinger(20,2), z-score from 20-day rolling mean
- Method: RSI extremes (<30/>70), BB position, z-score magnitude
- Scoring: +100 (deeply oversold, high reversion probability), -100 (overbought)

### 2D. SC-04 Momentum — `signals/momentum.py` (Weight: 10%)

- Input: returns (5d/10d/20d/60d), ROC
- Method: multi-timeframe momentum scoring, acceleration detection
- Scoring: weighted average across timeframes

### 2E. SC-05 Volume Analysis — `signals/volume.py` (Weight: 6%)

- Input: volume, price, OBV, Accumulation/Distribution line
- Method: volume-price divergence detection, A/D trend
- Scoring: bullish divergence → positive, bearish divergence → negative

### 2F. SC-06 Sentiment — `signals/sentiment.py` (Weight: 8%)

- Input: news headlines via RSS/API (configurable sources)
- Method: TextBlob polarity aggregation over 3-day lookback
- Scoring: average polarity × 100
- Upgradeable to FinBERT later

### 2G. SC-07 Fundamental — `signals/fundamental.py` (Weight: 8%)

- Input: EPS growth, PEG, revenue growth, D/E ratio, margins
- Method: multi-factor quality scoring (each factor 0-20, sum normalized)
- Scoring: high quality → positive, deteriorating → negative

### 2H. SC-08 Valuation — `signals/valuation.py` (Weight: 12%)

- Input: P/E, P/B, EV/EBITDA, sector comparables
- Method: relative valuation vs sector peers + DCF margin of safety estimate
- Scoring: undervalued → positive, overvalued → negative

### 2I. SC-09 Macro Overlay — `signals/macro.py` (Weight: 10%)

- Input: VIX, yield curve (10Y-2Y spread), market breadth, DXY, credit spreads
- Method: multi-indicator macro environment scoring
- Scoring: favorable macro → positive, deteriorating → negative

### 2J. SC-10 Options Flow — `signals/options.py` (Weight: Bonus/Additive)

- Input: put/call ratios, unusual volume, implied vol skew
- Method: z-score anomaly detection (flag activity > 2σ from 20-day mean)
- Scoring: additive bonus to composite (not weighted in the 100% ensemble)

### 2K. Signal Combiner — `signals/combiner.py`

**Formula:** `composite = Σ(score[i] × weight[i]) + options_bonus`

**Action mapping:**
- BUY if composite > +30 (configurable)
- SELL if composite < -30 (configurable)
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

- Markowitz optimization with Ledoit-Wolf covariance shrinkage (via sklearn)
- Input: expected returns (from composite signals), covariance matrix
- Output: optimal weight vector
- Constraint: all weights ≥ 0 (long-only), sum = 1.0
- Fallback: equal-weight if solver fails (NFR-005)

### 3B. Position Sizer — `portfolio/sizer.py`

- Half-Kelly position sizing: `f* = 0.5 × (win_rate - (1-win_rate)/avg_win_loss_ratio)`
- Cap max single position at 15% (configurable)
- 70/30 blend: `final_weight = 0.7 × signal_weight + 0.3 × optimizer_weight`

### 3C. Regime Exposure — `portfolio/exposure.py`

- Scale total portfolio exposure by regime:
  - Bull: up to 100%
  - Sideways: cap at 70%
  - Bear: cap at 40%
- Linear interpolation during transitions using HMM transition probabilities

### 3D. Exit Rules — `portfolio/exits.py`

Four independent exit triggers (most restrictive wins):
1. **Hard Stop:** fixed % loss from entry (default -8%)
2. **Trailing Stop:** % from peak (default -12%)
3. **Time Exit:** max holding period (default 60 trading days)
4. **Earnings Proximity:** flatten 2 days before earnings unless confidence > 0.7

**Output contract:**
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

### 4A. RM-01 Correlation Monitor — `risk/correlation.py`
- 20-day rolling pairwise correlation
- YELLOW (>0.4): warn. RED (>0.6): block new correlated positions

### 4B. RM-02 Drawdown Circuit Breaker — `risk/drawdown.py`
- WARNING (-10%): halve new position sizes
- DANGER (-15%): halt all new trades
- CRITICAL (-20%): flatten everything to cash

### 4C. RM-03 Volatility Model — `risk/volatility.py`
- Realized vol (20d, 5d, Parkinson), vol-of-vol
- Dynamic multiplier: Low=1.2×, Normal=1.0×, High=0.6×, Extreme=0.35×

### 4D. RM-04 Sector Rotation — `risk/sectors.py`
- 11-sector relative strength (20d/60d)
- Quadrant: Leading / Improving / Lagging / Weakening
- Block overweight in Lagging sectors

### 4E. RM-05 Stress Tester — `risk/stress.py`
- Simulate portfolio against 2008, 2020 (COVID), 2022 (rates), stagflation
- Report: max drawdown, time-to-recovery, survival probability per scenario

### 4F. RM-06 Concentration Monitor — `risk/concentration.py`
- Flag single position > 15% or top-3 > 40%

### 4G. RM-07 Liquidity Monitor — `risk/liquidity.py`
- Flag positions where allocation > 1% of 20-day average daily volume

### 4H. Risk Override Applier — `risk/overrides.py`
- Applies all risk monitor outputs to position sizes
- Risk always overrides signal/portfolio recommendations
- If circuit breaker = DANGER → no new trades regardless of signal strength

---

## 5. Layer 4: Self-Awareness (Sprint 5)

### 5A. SA-01 Signal Decay Monitor — `selfaware/decay.py`
- Track IC (Information Coefficient) and hit rate per component
- Rolling window: 60 trading days (configurable)
- Decay flag: IC < 0.02 or hit rate < 48%
- On decay: reduce weight by 50%, redistribute proportionally

### 5B. SA-02 A/B Testing Framework — `selfaware/ab_test.py`
- Run 2 strategy configs on equal virtual capital simultaneously
- Track daily equity curves, compute alpha (return difference)
- t-test for significance: winner declared at p < 0.05, min 20 days
- Output: daily comparison JSON

### 5C. SA-03 Adaptive Weights — `selfaware/weights.py`
- Weekly rebalance (every 5 trading days)
- Higher recent IC/hit rate → increased weight
- Bounds: min 2%, max 30% per component
- Weights always sum to 100%

### 5D. SA-04 Performance Attribution — `selfaware/attribution.py`
- Decompose P&L per trade: which signal drove entry, which regime informed sizing, which exit triggered
- Per-trade and per-period attribution JSON

### 5E. SA-05 Auto Journal — `selfaware/journal.py`
- Log every event: trade, signal run, regime change, weight adjustment, risk override, A/B update
- SHA-256 checksum per entry
- Append-only, searchable by date/ticker/event_type/component
- One file per month: `journal/YYYY-MM.jsonl`

---

## 6. Layer 5: Dashboard & API (Sprint 6)

### 6A. Dashboard Aggregator — `dashboard/aggregator.py`

Assemble all pipeline outputs into single JSON with 17 sections:

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
- `rich` tables for signal scores, portfolio, risk status
- Color-coded risk levels (green/yellow/red)
- Sparkline for equity curve

### 6C. API Server (Optional) — `dashboard/server.py`
- Simple HTTP server serving `dashboard_api.json`
- For Command Center integration

---

## 7. File System Layout

```
~/meridian/
├── config/
│   ├── meridian_config.yaml    # All parameters
│   └── tickers.txt             # Ticker universe
├── core/
│   └── pipeline.py             # 13-step orchestrator
├── cli/
│   └── main.py                 # Click CLI
├── signals/
│   ├── regime.py               # SC-01: HMM regime
│   ├── trend.py                # SC-02: Trend following
│   ├── reversion.py            # SC-03: Mean reversion
│   ├── momentum.py             # SC-04: Momentum
│   ├── volume.py               # SC-05: Volume analysis
│   ├── sentiment.py            # SC-06: Sentiment NLP
│   ├── fundamental.py          # SC-07: Fundamentals
│   ├── valuation.py            # SC-08: Valuation
│   ├── macro.py                # SC-09: Macro overlay
│   ├── options.py              # SC-10: Options flow
│   └── combiner.py             # Weighted ensemble
├── portfolio/
│   ├── optimizer.py            # Mean-variance + Ledoit-Wolf
│   ├── sizer.py                # Half-Kelly + blend
│   ├── exposure.py             # Regime-adaptive exposure
│   └── exits.py                # 4 exit rule types
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
│   ├── ab_test.py              # SA-02: A/B testing
│   ├── weights.py              # SA-03: Adaptive weights
│   ├── attribution.py          # SA-04: P&L decomposition
│   └── journal.py              # SA-05: Auto-journal
├── dashboard/
│   ├── aggregator.py           # 17-section JSON assembly
│   ├── cli_render.py           # Terminal formatting
│   └── server.py               # Optional HTTP server
├── data/
│   ├── raw/                    # Market data cache (rolling 2yr)
│   ├── signals/                # Signal outputs per run (1yr)
│   ├── portfolio/              # Portfolio states (permanent)
│   ├── risk/                   # Risk monitor outputs (1yr)
│   ├── selfaware/              # Signal health, A/B, weights (permanent)
│   └── checkpoints/            # Pipeline checkpoints
├── journal/                    # Append-only JSONL (permanent)
├── backtest/                   # Backtest results (permanent)
├── logs/                       # Execution logs (30 days)
└── tests/
    ├── unit/                   # pytest unit tests (>80% coverage)
    ├── integration/            # Module-to-module data flow
    └── system/                 # Full pipeline e2e
```

---

## 8. Non-Functional Requirements

| ID | Category | Target |
|----|----------|--------|
| NFR-001 | Performance | Full pipeline < 120s (50 tickers, M-series Mac) |
| NFR-002 | Performance | Signal gen (L1) < 60s (50 tickers) |
| NFR-003 | Reliability | Retry 3× with backoff; use cached on failure |
| NFR-004 | Reliability | Checkpoint after each layer; resume on crash |
| NFR-005 | Storage | < 500MB for 1 year of 50-ticker data |
| NFR-006 | Security | No outbound except yfinance API |
| NFR-007 | Portability | macOS (ARM), Ubuntu 24, Windows WSL2 |
| NFR-008 | Maintainability | Unit tests >80% coverage (pytest) |
| NFR-009 | Configurability | Single YAML config with documented defaults |
| NFR-010 | Extensibility | Plugin interface for custom signal components |

---

## 9. Implementation Order

**Build in this exact order. Each step depends on the previous.**

1. `config/loader.py` + `meridian_config.yaml` (default config)
2. `data/fetcher.py` (with adapter interface)
3. `core/pipeline.py` (skeleton — just steps 1-3 first)
4. `signals/regime.py` → `signals/trend.py` → ... → `signals/combiner.py` (all 11 files)
5. `portfolio/optimizer.py` → `portfolio/sizer.py` → `portfolio/exposure.py` → `portfolio/exits.py`
6. `risk/` (all 8 files)
7. `selfaware/` (all 5 files)
8. `dashboard/aggregator.py` → `dashboard/cli_render.py`
9. `cli/main.py` (wire all commands)
10. Tests (unit → integration → system)

---

## 10. Open Architecture Decisions

These need answers before Sprint 1:

| # | Question | Recommendation |
|---|----------|---------------|
| Q-01 | Abstract yfinance behind adapter now or Phase 3? | **Now** — adds 2 days, de-risks completely |
| Q-02 | A/B test support >2 strategies? | **No** — 2-way for Phase 1, multi-arm Phase 3 |
| Q-03 | Min paper trading before real capital? | **90 days** — 30 too short, 6 months too conservative |
| Q-04 | Journal: JSON or SQLite? | **JSONL** Phase 1 (simpler), SQLite Phase 2 (query perf) |
| Q-05 | RAMICHE OS agent bus integration? | **Yes** — MERIDIAN health → TRIAGE, alerts → Atlas |
| Q-06 | License? | **Apache 2.0** — permissive but patent protection |
| Q-07 | Backtest-on-install verification? | **Yes** — `meridian init` runs quick 30-day backtest |

---

## 11. Existing Prototype Reference

SIMONS built a working 34-module prototype in 4 days. Key metrics from that build:
- Paper portfolio: +28.78% (8 trading days)
- A/B alpha vs buy & hold: +13.41%
- Win rate: 60%, Max drawdown: 0.21%, Sharpe: 2.81
- Avg pairwise correlation: 0.18 (GREEN)
- ~6,000 LOC across 34 modules
- Infrastructure cost: $0

The existing codebase should be refactored into this specification's structure, not rewritten from scratch. Preserve working logic, restructure file layout, add missing tests and validation.

---

*Generated from MERIDIAN Functional Specification v1.0 (SIMONS, March 27, 2026) + Summary PDF. Ready for Cursor implementation.*
