# Meridian — Full Audit + Implementation Plan for Claude Code

## Project
- Repo: /Users/admin/.openclaw/workspace/projects/meridian-repo
- Language: Python 3.10+
- Framework: NumPy, Pandas, SciPy, scikit-learn, hmmlearn, yfinance, Click, Rich
- Spec: IMPLEMENTATION.md (21,816 bytes, 13-step pipeline spec)
- Refactoring guide: CURSOR-GUIDE.md (26,099 bytes, 42-module mapping)
- Status: **~35% functional, ~65% scaffolding/incomplete**

## What Meridian Is
A self-aware quantitative trading operating system with 5 layers:
1. **Signal Generation** — 10 components scoring tickers (-100 to +100)
2. **Portfolio Intelligence** — optimization, position sizing, exits
3. **Risk Management** — 7 monitors + override applier
4. **Self-Awareness** — signal decay tracking, A/B testing, adaptive weights, attribution
5. **Dashboard** — 17-section JSON aggregator + CLI renderer + HTTP server

The system runs a 13-step pipeline daily: Data Fetch → Regime Detect → Signal Score → Portfolio Optimize → Position Size → Risk Check → Override Apply → Paper Trade → Decay Track → Attribution → Journal → Dashboard → Checkpoint.

---

## PHASE 1: CRITICAL FIXES (DO FIRST)

### 1. Refactor All Hardcoded Paths
**Every file** contains `/Users/admin/.openclaw/workspace-simons/data` or similar hardcoded paths.

Fix: Replace ALL hardcoded paths with a centralized `config/paths.py`:

```python
# config/paths.py
from pathlib import Path
import os

def get_data_dir() -> Path:
    """Returns the Meridian data directory. Respects MERIDIAN_DATA_DIR env var."""
    return Path(os.environ.get("MERIDIAN_DATA_DIR", Path.home() / "meridian" / "data"))

def get_config_dir() -> Path:
    return Path(os.environ.get("MERIDIAN_CONFIG_DIR", Path.home() / "meridian" / "config"))

def get_journal_dir() -> Path:
    return get_data_dir() / "journal"

def get_signals_dir() -> Path:
    return get_data_dir() / "signals"

def get_portfolio_dir() -> Path:
    return get_data_dir() / "portfolio"

def get_risk_dir() -> Path:
    return get_data_dir() / "risk"

def get_selfaware_dir() -> Path:
    return get_data_dir() / "selfaware"

def get_dashboard_dir() -> Path:
    return get_data_dir() / "dashboard"
```

Then search-and-replace every file that has a hardcoded path to use these functions instead. Files to fix:
- `core/pipeline.py` (line 1-5, sys.path hack)
- `core/paper_trader.py` (line ~12)
- `core/watchlist_scanner.py`
- `core/watchlist_expander.py`
- `core/confidence_index.py`
- `core/weekly_report.py`
- `signals/combiner.py`
- `signals/options.py`
- `portfolio/exits.py`
- `risk/correlation.py`
- `risk/drawdown.py`
- `risk/volatility.py`
- `risk/sectors.py`
- `risk/stress.py`
- `selfaware/decay.py`
- `selfaware/ab_test.py`
- `selfaware/journal.py`
- `dashboard/aggregator.py`
- `cli/install_cron.py`
- `tests/test_pipeline.py`

Remove ALL `sys.path.insert()` hacks.

---

### 2. Implement Config Loader
**File: `config/loader.py`** (NEW — does not exist)

Create a YAML config loader per the spec in IMPLEMENTATION.md section 1A:

```python
# Must implement:
# - load_config(path: str = None) -> dict
# - validate all parameters with ranges
# - raise ConfigError on invalid values
# - merge user config with defaults
```

**File: `config/meridian_config.yaml`** (NEW — does not exist)

Create default config with these parameter groups (from IMPLEMENTATION.md):
- `universe`: tickers list, benchmark
- `regime`: n_states, feature_weights, lookback_days
- `signals`: component weights (regime 16%, trend 12%, mean_rev 12%, momentum 9%, volume 5%, sentiment 7%, fundamental 7%, valuation 10%, macro 9%, options 13%)
- `portfolio`: max_position_pct (20%), max_long_pct (80%), rebalance_freq
- `risk`: drawdown_warning (-10%), drawdown_danger (-15%), drawdown_critical (-20%), correlation_threshold (0.7), max_sector_pct (30%)
- `sizing`: kelly_fraction (0.5), blend_ratio (0.7 kelly / 0.3 equal), max_risk_per_trade (2%)
- `exits`: hard_stop_pct (-8%), take_profit_pct (20%), trailing_activation (10%), trailing_pct (60%), time_decay_days (20), time_decay_min_gain (3%)
- `selfaware`: min_observations (20), ic_threshold (0.03), hit_rate_threshold (50%), weight_bounds (0.5, 2.0)
- `paper_trade`: slippage_bps (10), commission_per_trade (0.0)
- `paths`: data_dir, journal_dir, dashboard_dir

---

### 3. Create Signal Base Class
**File: `signals/base.py`** (NEW — does not exist)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
import pandas as pd

@dataclass
class SignalOutput:
    """Standardized output from every signal component."""
    score: float          # -100 to +100
    confidence: float     # 0.0 to 1.0
    metadata: Dict[str, Any]  # component-specific details
    ticker: str
    component_name: str

class SignalComponent(ABC):
    """Abstract base class for all signal components."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Component name (e.g., 'regime', 'trend', 'momentum')."""
        pass

    @abstractmethod
    def score(self, ticker: str, data: pd.DataFrame, **kwargs) -> SignalOutput:
        """Compute signal score for a single ticker."""
        pass
```

Then refactor ALL existing signal files to inherit from `SignalComponent`:
- `signals/regime.py` → class `RegimeSignal(SignalComponent)`
- `signals/fundamental.py` → class `FundamentalSignal(SignalComponent)`
- `signals/valuation.py` → class `ValuationSignal(SignalComponent)`
- `signals/macro.py` → class `MacroSignal(SignalComponent)`
- `signals/options.py` → class `OptionsSignal(SignalComponent)`
- `signals/trend_proto.py` → rename to `signals/trend.py`, class `TrendSignal(SignalComponent)`
- `signals/momentum_proto.py` → rename to `signals/momentum.py`, class `MomentumSignal(SignalComponent)`
- `signals/combiner.py` → update to use `SignalComponent.score()` interface

---

## PHASE 2: MISSING SIGNAL COMPONENTS (IMPLEMENT)

### 4. Mean Reversion Signal (NEW)
**File: `signals/mean_reversion.py`** (NEW — does not exist, spec ref SC-03)

```python
class MeanReversionSignal(SignalComponent):
    """RSI + Bollinger Bands + z-score mean reversion detector."""
    # RSI(14): oversold <30 (+50), overbought >70 (-50)
    # Bollinger(20,2): below lower band (+30), above upper (-30)
    # z-score of 20-day returns: >2σ → mean revert signal
    # Weighted combo: RSI 40%, Bollinger 35%, z-score 25%
```

### 5. Volume Signal (NEW)
**File: `signals/volume.py`** (NEW — does not exist, spec ref SC-05)

```python
class VolumeSignal(SignalComponent):
    """OBV trend + Accumulation/Distribution + volume anomaly detector."""
    # OBV slope (20-day): positive divergence from price = bullish
    # A/D line: Chaikin Money Flow proxy
    # Volume vs 20-day average: >2x = anomaly flag
    # Weighted combo: OBV 40%, A/D 35%, anomaly 25%
```

### 6. Fix Sentiment Signal
**File: `signals/sentiment.py`** (refactor from code in `combiner.py`)

The current sentiment logic in combiner.py tries `stock.news` which varies by yfinance version. Fix:
```python
class SentimentSignal(SignalComponent):
    """TextBlob headline sentiment + news volume."""
    # Fetch news via yfinance Ticker.news (returns list of dicts)
    # Parse each headline through TextBlob
    # Average polarity (-1 to +1) → scale to (-100 to +100)
    # News volume: >5 articles/day = high attention
    # Handle: empty news gracefully (return score=0, confidence=0.1)
```

### 7. Fix Market Timing
**File: `signals/market_timing_proto.py`** → merge into `signals/macro.py`

Move the portfolio-level risk-on/risk-off logic into macro.py as a method. Delete the proto file. The macro signal should include:
- VIX regime (using ^VIX, not SPY proxy)
- Treasury curve (2Y-10Y spread using ^TYX and ^FVX)
- Real market breadth (via sector ETFs % above 200-day MA)
- Dollar strength (DXY)
- Credit spreads (HYG vs LQD)

---

## PHASE 3: MISSING RISK MODULES (IMPLEMENT)

### 8. Concentration Monitor (NEW)
**File: `risk/concentration.py`** (NEW — does not exist, spec ref RM-06)

```python
class ConcentrationMonitor:
    """Enforces position and sector concentration limits."""
    # Single position: warn >15%, block >20%
    # Top-3 positions: warn >40%, block >50%
    # Single sector: warn >30%, block >40%
    # Returns: allowed=True/False, multiplier (0.0 to 1.0), reason
```

### 9. Liquidity Monitor (NEW)
**File: `risk/liquidity.py`** (NEW — does not exist, spec ref RM-07)

```python
class LiquidityMonitor:
    """Ensures positions don't exceed ADV limits."""
    # Position value < 1% of 20-day average daily volume
    # Warn at 0.5%, block at 1.0%
    # Returns: allowed=True/False, max_shares, reason
```

### 10. Risk Override Applier (NEW)
**File: `risk/overrides.py`** (NEW — does not exist)

```python
class RiskOverrideApplier:
    """Applies all risk constraints to proposed trades."""
    # Input: proposed_trades (list of {ticker, shares, direction})
    # Checks in order: drawdown breaker → volatility → correlation → concentration → liquidity → sector
    # Output: filtered_trades with risk-adjusted sizes + override_log
    # Any CRITICAL block → reject trade entirely
    # WARNING → reduce size by multiplier
```

---

## PHASE 4: COMPLETE SELF-AWARENESS LAYER

### 11. Fix Signal Decay (`selfaware/decay.py`)
- Implement actual IC (Information Coefficient) calculation: `corr(signal_score, forward_5d_return)`
- Rolling 60-day window
- Track per-component hit rate (% of scores with correct direction)
- Output: JSON with {component, ic, hit_rate, samples, status: "healthy"|"decaying"|"dead"}
- Trigger weight rebalancing when IC < 0.03 or hit_rate < 50%

### 12. Fix A/B Testing (`selfaware/ab_test.py`)
- Implement Welch's t-test for significance (scipy.stats.ttest_ind)
- Track daily equity for both strategies
- Output: {alpha_bps, t_stat, p_value, significant: bool, winner: "A"|"B"|"inconclusive"}
- Require min 60 observations before declaring significance

### 13. Fix Adaptive Weights (`selfaware/weights.py`)
- Implement sigmoid scaling: `new_weight = base_weight * sigmoid(performance_z_score)`
- Bounds: 0.5x to 2.0x base weight
- Normalize so all weights sum to 1.0
- Only activate after 20+ observations per component
- Output: updated weight dict + rebalance log

### 14. Fix Attribution (`selfaware/attribution.py`)
- Load trade history from paper_trader state
- For each closed trade: decompose P&L by signal component weight at entry
- Output: {component: total_pnl, avg_contribution, best_trade, worst_trade}
- Aggregate by time period (daily, weekly, monthly)

### 15. Fix Journal (`selfaware/journal.py`)
- Append-only JSONL format (one JSON object per line)
- SHA-256 checksum per entry (hash of previous entry + current entry → chain)
- Monthly file rotation: `journal/YYYY-MM.jsonl`
- Entry schema: {timestamp, event_type, portfolio_state, signals, risk_state, decisions, checksum}
- Searchable by: date range, ticker, event_type

---

## PHASE 5: COMPLETE 13-STEP PIPELINE

### 16. Rewrite `core/pipeline.py`

The current pipeline only has steps 1-3 as stubs. Implement the full 13-step pipeline:

```python
class MeridianPipeline:
    def __init__(self, config: dict):
        self.config = config
        self.checkpoint = CheckpointManager(config)

    def run(self, resume_from: int = 0):
        steps = [
            self.step_01_fetch_data,
            self.step_02_detect_regime,
            self.step_03_generate_signals,
            self.step_04_optimize_portfolio,
            self.step_05_size_positions,
            self.step_06_check_risk,
            self.step_07_apply_overrides,
            self.step_08_execute_trades,
            self.step_09_track_decay,
            self.step_10_compute_attribution,
            self.step_11_write_journal,
            self.step_12_assemble_dashboard,
            self.step_13_save_checkpoint,
        ]
        for i, step in enumerate(steps):
            if i < resume_from:
                continue
            result = step()
            self.checkpoint.save(i, result)
        return self.checkpoint.final_state()
```

Add `CheckpointManager` class:
```python
class CheckpointManager:
    """Saves/loads pipeline state after each step for crash recovery."""
    # Save: data/{date}/checkpoint_{step}.json
    # Load: find latest checkpoint, resume from next step
    # Cleanup: keep last 7 days of checkpoints
```

---

## PHASE 6: COMPLETE CLI

### 17. Implement Full CLI
**File: `cli/main.py`** (NEW — does not exist)

```python
import click
from rich.console import Console
from rich.table import Table

@click.group()
def cli():
    """Meridian — Self-Aware Quantitative Trading OS"""
    pass

@cli.command()
def status():
    """Show portfolio status, regime, drawdown level."""
    pass

@cli.command()
@click.argument('ticker', required=False)
def signals(ticker):
    """Show latest signal scores. Optional: single ticker."""
    pass

@cli.command()
def portfolio():
    """Show current positions, P&L, allocations."""
    pass

@cli.command()
def risk():
    """Show risk dashboard: drawdown, correlation, volatility, sectors."""
    pass

@cli.command()
def health():
    """Show signal decay status, IC, hit rates."""
    pass

@cli.command()
def ab():
    """Show A/B test status and results."""
    pass

@cli.command()
def journal():
    """Show recent journal entries."""
    pass

@cli.command()
@click.option('--start', help='Start date YYYY-MM-DD')
@click.option('--end', help='End date YYYY-MM-DD')
def backtest(start, end):
    """Run historical backtest."""
    pass

@cli.command()
def config():
    """Show current configuration."""
    pass

@cli.command()
def run():
    """Execute full 13-step pipeline."""
    pass

@cli.command()
def scan():
    """Scan watchlist for new opportunities."""
    pass
```

---

## PHASE 7: COMPLETE DASHBOARD

### 18. Complete Dashboard Aggregator (`dashboard/aggregator.py`)
Implement all 17 sections of the dashboard JSON:

```python
def assemble_dashboard() -> dict:
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "sections": {
            "portfolio_state": load_portfolio_state(),
            "signals_latest": load_latest_signals(),
            "signal_decomposition": load_signal_decomposition(),
            "regime_state": load_regime_state(),
            "optimizer_output": load_optimizer_output(),
            "position_sizing": load_position_sizing(),
            "risk_dashboard": load_risk_dashboard(),
            "correlation_matrix": load_correlation_matrix(),
            "drawdown_status": load_drawdown_status(),
            "volatility_regime": load_volatility_regime(),
            "sector_rotation": load_sector_rotation(),
            "stress_test": load_stress_test(),
            "signal_health": load_signal_health(),
            "ab_test_status": load_ab_test_status(),
            "weight_history": load_weight_history(),
            "attribution": load_attribution(),
            "journal_recent": load_journal_recent(),
        }
    }
```

Validate output < 200KB. Save as `data/dashboard/dashboard_{timestamp}.json`.

### 19. Implement CLI Renderer
**File: `dashboard/cli_render.py`** (NEW)

Use Rich library to render dashboard JSON as formatted terminal output:
- Rich Tables for portfolio/positions
- Rich Panel for regime/drawdown status
- Rich Progress bars for signal confidence
- Color coding: green (bullish), red (bearish), yellow (neutral)

### 20. Implement HTTP Server
**File: `dashboard/server.py`** (replace `server_proto.py`)

Simple Flask or http.server:
- `GET /` → latest dashboard JSON
- `GET /history` → list of available snapshots
- `GET /history/{timestamp}` → specific snapshot
- No auth needed (local only)

---

## PHASE 8: TESTING

### 21. Write Tests
**Files: `tests/` directory**

```
tests/
├── unit/
│   ├── test_config_loader.py       # Config validation
│   ├── test_regime.py              # HMM regime detection
│   ├── test_signals.py             # Each signal component
│   ├── test_combiner.py            # Weighted ensemble
│   ├── test_optimizer.py           # Portfolio optimization
│   ├── test_exits.py               # Exit rules
│   ├── test_drawdown.py            # Circuit breaker
│   ├── test_concentration.py       # Position limits
│   ├── test_liquidity.py           # ADV limits
│   ├── test_decay.py               # IC + hit rate
│   ├── test_ab_test.py             # t-test
│   └── test_journal.py             # Append-only + checksums
├── integration/
│   ├── test_pipeline.py            # 13-step pipeline
│   └── test_risk_chain.py          # All risk monitors in sequence
└── system/
    └── test_full_run.py            # End-to-end with sample data
```

Each test file should:
- Use synthetic data (no yfinance calls in tests)
- Assert correctness, not just smoke test
- Clean up after itself (no leftover state files)

---

## DELIVERABLES (IN ORDER)

1. Fix all hardcoded paths (config/paths.py + search-replace across 20+ files)
2. Implement config/loader.py + config/meridian_config.yaml
3. Create signals/base.py (SignalComponent ABC)
4. Refactor all existing signals to inherit from SignalComponent
5. Implement missing signals: mean_reversion.py, volume.py, sentiment.py
6. Merge market_timing_proto.py into macro.py, fix incomplete components
7. Implement risk/concentration.py, risk/liquidity.py, risk/overrides.py
8. Fix selfaware/ layer: decay.py, ab_test.py, weights.py, attribution.py, journal.py
9. Rewrite core/pipeline.py with full 13-step pipeline + CheckpointManager
10. Implement cli/main.py with 12 Click commands
11. Complete dashboard/aggregator.py (17 sections)
12. Implement dashboard/cli_render.py (Rich terminal output)
13. Replace dashboard/server_proto.py with dashboard/server.py (Flask)
14. Delete all *_proto.py files after merging their code
15. Write comprehensive tests (unit + integration + system)
16. Run full pipeline end-to-end and verify output
17. Run `python -m pytest tests/` — all tests must pass

## IMPORTANT CONSTRAINTS
- Python 3.10+ only
- No new dependencies beyond what's in pyproject.toml (numpy, pandas, scipy, scikit-learn, hmmlearn, textblob, yfinance, pyyaml, click, rich, backtesting) — add Flask for the server
- All paths via config/paths.py — zero hardcoded paths
- All signal components inherit from SignalComponent
- All config via config/meridian_config.yaml
- All data persistence uses JSON/JSONL (no databases)
- Journal entries are append-only with SHA-256 chain
- Dashboard JSON < 200KB
- Tests use synthetic data (no external API calls)
