/**
 * cost-logger.js — JSONL Structured Cost Logger for OpenClaw
 *
 * Every LLM API call is logged as a single JSON line in logs/cost-log.jsonl.
 * This provides a complete audit trail of token usage, cost, cache behavior,
 * and per-agent attribution.
 *
 * Exports:
 *   logCall(data)            — Append one log entry
 *   getSummary(dateRange)    — Aggregate cost/token stats for a date range
 *   getByAgent()             — Group totals by agent name
 *   getTotalSaved()          — Estimated USD saved via cache hits
 *   readAllLogs()            — Parse the full JSONL file into an array
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'cost-log.jsonl');

// Pricing per 1 M tokens (as of early 2025, adjust as needed)
const PRICING = {
  'claude-opus-4':       { input: 15.00, output: 75.00 },
  'claude-opus-4-6':     { input: 15.00, output: 75.00 },
  'claude-sonnet-4':     { input:  3.00, output: 15.00 },
  'claude-sonnet-4-5':   { input:  3.00, output: 15.00 },
  'claude-haiku-4':      { input:  0.80, output:  4.00 },
  'claude-haiku-4-5':    { input:  0.80, output:  4.00 },
  default:               { input:  3.00, output: 15.00 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make sure the log directory exists.
 */
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Compute cost in USD for a given model and token counts.
 */
function computeCost(model, inputTokens, outputTokens) {
  const rates = PRICING[model] || PRICING.default;
  return (
    (inputTokens  / 1_000_000) * rates.input +
    (outputTokens / 1_000_000) * rates.output
  );
}

/**
 * Parse a date string (YYYY-MM-DD) or Date object into epoch ms at start of day.
 */
function toEpochStart(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toEpochEnd(dateStr) {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Log a single API call to the JSONL file.
 *
 * @param {object} data
 * @param {string}  data.model         — e.g. "claude-opus-4"
 * @param {number}  data.input_tokens  — Tokens in the prompt
 * @param {number}  data.output_tokens — Tokens in the response
 * @param {boolean} data.cache_hit     — Whether a cache hit was used
 * @param {string}  data.agent_name    — The OpenClaw agent that made the call
 * @param {string}  data.session_id    — Current session identifier
 * @param {number}  [data.cost_usd]    — Override auto-calculated cost
 * @param {string}  [data.prompt_hash] — SHA-256 of the prompt (from cache-engine)
 * @param {string}  [data.match_type]  — "exact" | "fuzzy" | "miss"
 */
function logCall(data) {
  ensureLogDir();

  const cost = data.cost_usd != null
    ? data.cost_usd
    : computeCost(data.model, data.input_tokens || 0, data.output_tokens || 0);

  const entry = {
    timestamp:     new Date().toISOString(),
    model:         data.model         || 'unknown',
    input_tokens:  data.input_tokens  || 0,
    output_tokens: data.output_tokens || 0,
    cost_usd:      parseFloat(cost.toFixed(6)),
    cache_hit:     !!data.cache_hit,
    agent_name:    data.agent_name    || 'unknown',
    session_id:    data.session_id    || 'default',
    prompt_hash:   data.prompt_hash   || null,
    match_type:    data.match_type    || null,
  };

  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf-8');

  return entry;
}

/**
 * Read and parse every line from the JSONL log.
 * @returns {object[]}
 */
function readAllLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];

  const raw = fs.readFileSync(LOG_FILE, 'utf-8');
  return raw
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

/**
 * Aggregate summary for a date range.
 *
 * @param {object}  [dateRange]
 * @param {string}  [dateRange.from]  — Start date (YYYY-MM-DD), inclusive
 * @param {string}  [dateRange.to]    — End date   (YYYY-MM-DD), inclusive
 * @returns {object}
 */
function getSummary(dateRange = {}) {
  const logs = readAllLogs();

  const from = dateRange.from ? toEpochStart(dateRange.from) : 0;
  const to   = dateRange.to   ? toEpochEnd(dateRange.to)     : Infinity;

  const filtered = logs.filter(l => {
    const ts = new Date(l.timestamp).getTime();
    return ts >= from && ts <= to;
  });

  const summary = {
    total_calls:       filtered.length,
    total_cost_usd:    0,
    total_input_tokens:  0,
    total_output_tokens: 0,
    cache_hits:        0,
    cache_misses:      0,
    cache_hit_rate:    '0%',
    by_model:          {},
    daily:             {},
  };

  for (const entry of filtered) {
    summary.total_cost_usd       += entry.cost_usd || 0;
    summary.total_input_tokens   += entry.input_tokens || 0;
    summary.total_output_tokens  += entry.output_tokens || 0;

    if (entry.cache_hit) summary.cache_hits++;
    else                 summary.cache_misses++;

    // By model
    const model = entry.model || 'unknown';
    if (!summary.by_model[model]) {
      summary.by_model[model] = { calls: 0, cost_usd: 0, input_tokens: 0, output_tokens: 0 };
    }
    summary.by_model[model].calls++;
    summary.by_model[model].cost_usd       += entry.cost_usd || 0;
    summary.by_model[model].input_tokens   += entry.input_tokens || 0;
    summary.by_model[model].output_tokens  += entry.output_tokens || 0;

    // Daily
    const day = entry.timestamp?.slice(0, 10) || 'unknown';
    if (!summary.daily[day]) {
      summary.daily[day] = { calls: 0, cost_usd: 0, cache_hits: 0, cache_misses: 0 };
    }
    summary.daily[day].calls++;
    summary.daily[day].cost_usd += entry.cost_usd || 0;
    if (entry.cache_hit) summary.daily[day].cache_hits++;
    else                 summary.daily[day].cache_misses++;
  }

  // Round cost figures
  summary.total_cost_usd = parseFloat(summary.total_cost_usd.toFixed(4));
  for (const m of Object.values(summary.by_model)) {
    m.cost_usd = parseFloat(m.cost_usd.toFixed(4));
  }
  for (const d of Object.values(summary.daily)) {
    d.cost_usd = parseFloat(d.cost_usd.toFixed(4));
  }

  if (summary.total_calls > 0) {
    summary.cache_hit_rate =
      ((summary.cache_hits / summary.total_calls) * 100).toFixed(1) + '%';
  }

  return summary;
}

/**
 * Group totals by agent name.
 * @returns {object} Keyed by agent_name with totals.
 */
function getByAgent() {
  const logs   = readAllLogs();
  const agents = {};

  for (const entry of logs) {
    const name = entry.agent_name || 'unknown';
    if (!agents[name]) {
      agents[name] = {
        calls: 0,
        cost_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_hits: 0,
        cache_misses: 0,
      };
    }
    agents[name].calls++;
    agents[name].cost_usd       += entry.cost_usd || 0;
    agents[name].input_tokens   += entry.input_tokens || 0;
    agents[name].output_tokens  += entry.output_tokens || 0;
    if (entry.cache_hit) agents[name].cache_hits++;
    else                 agents[name].cache_misses++;
  }

  // Round
  for (const a of Object.values(agents)) {
    a.cost_usd = parseFloat(a.cost_usd.toFixed(4));
  }

  return agents;
}

/**
 * Estimate total USD saved by cache hits.
 *
 * For each cache-hit entry we assume the full cost would have been incurred
 * without the cache.  The "saved" amount equals the cost_usd of those entries
 * (since those tokens were never actually sent to the API).
 *
 * @returns {{ total_saved_usd: number, total_spent_usd: number, savings_pct: string }}
 */
function getTotalSaved() {
  const logs     = readAllLogs();
  let savedUsd   = 0;
  let spentUsd   = 0;

  for (const entry of logs) {
    if (entry.cache_hit) {
      savedUsd += entry.cost_usd || 0;
    } else {
      spentUsd += entry.cost_usd || 0;
    }
  }

  const wouldHaveSpent = spentUsd + savedUsd;
  const pct = wouldHaveSpent > 0
    ? ((savedUsd / wouldHaveSpent) * 100).toFixed(1) + '%'
    : '0%';

  return {
    total_saved_usd:  parseFloat(savedUsd.toFixed(4)),
    total_spent_usd:  parseFloat(spentUsd.toFixed(4)),
    would_have_spent: parseFloat(wouldHaveSpent.toFixed(4)),
    savings_pct:      pct,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  logCall,
  getSummary,
  getByAgent,
  getTotalSaved,
  readAllLogs,
  computeCost,
};
