/**
 * server.js — Express API & Dashboard Server for OpenClaw Semantic Cache
 *
 * Endpoints:
 *   GET  /              — Serves the analytics dashboard (dashboard/index.html)
 *   GET  /api/logs      — Returns all cost-log.jsonl entries as a JSON array
 *   GET  /api/stats     — Returns cache stats + cost summary + savings
 *   GET  /api/agents    — Returns cost breakdown by agent
 *   GET  /api/saved     — Returns total savings estimate
 *   POST /api/lookup    — Perform a cache lookup    { prompt }
 *   POST /api/store     — Store a cache entry       { prompt, response, metadata }
 *
 * Port: 3847 (configurable via PORT env var)
 */

'use strict';

const express     = require('express');
const path        = require('path');
const cacheEngine = require('./cache-engine');
const costLogger  = require('./cost-logger');

const app  = express();
const PORT = process.env.PORT || 3847;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '5mb' }));

// CORS — allow dashboard fetch from any origin during development
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ---------------------------------------------------------------------------
// Static — serve dashboard
// ---------------------------------------------------------------------------

app.use(express.static(path.join(__dirname, 'dashboard')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

// ---------------------------------------------------------------------------
// API — Log endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/logs
 * Query params:
 *   from — start date YYYY-MM-DD (optional)
 *   to   — end date   YYYY-MM-DD (optional)
 */
app.get('/api/logs', (req, res) => {
  try {
    const logs = costLogger.readAllLogs();

    // Optional date filtering
    const from = req.query.from ? new Date(req.query.from).getTime() : 0;
    const to   = req.query.to   ? new Date(req.query.to + 'T23:59:59').getTime() : Infinity;

    const filtered = logs.filter(l => {
      const ts = new Date(l.timestamp).getTime();
      return ts >= from && ts <= to;
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/stats
 * Query params:
 *   from — start date YYYY-MM-DD (optional)
 *   to   — end date   YYYY-MM-DD (optional)
 */
app.get('/api/stats', (req, res) => {
  try {
    const dateRange = {};
    if (req.query.from) dateRange.from = req.query.from;
    if (req.query.to)   dateRange.to   = req.query.to;

    const costSummary  = costLogger.getSummary(dateRange);
    const cacheStats   = cacheEngine.stats();
    const savings      = costLogger.getTotalSaved();

    res.json({
      cache:   cacheStats,
      cost:    costSummary,
      savings: savings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/agents
 */
app.get('/api/agents', (_req, res) => {
  try {
    res.json(costLogger.getByAgent());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/saved
 */
app.get('/api/saved', (_req, res) => {
  try {
    res.json(costLogger.getTotalSaved());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API — Cache endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/lookup
 * Body: { "prompt": "..." }
 */
app.post('/api/lookup', (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const result = cacheEngine.lookup(prompt);
    res.json({ cached: !!result, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/store
 * Body: { "prompt": "...", "response": "...", "metadata": {} }
 */
app.post('/api/store', (req, res) => {
  try {
    const { prompt, response, metadata } = req.body;
    if (!prompt || !response) {
      return res.status(400).json({ error: 'prompt and response are required' });
    }

    const result = cacheEngine.store(prompt, response, metadata);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[semantic-cache] Dashboard & API running at http://localhost:${PORT}`);
  console.log(`[semantic-cache] API endpoints:`);
  console.log(`  GET  /api/logs    — Cost log entries`);
  console.log(`  GET  /api/stats   — Cache + cost stats`);
  console.log(`  GET  /api/agents  — Breakdown by agent`);
  console.log(`  GET  /api/saved   — Total savings`);
  console.log(`  POST /api/lookup  — Cache lookup`);
  console.log(`  POST /api/store   — Cache store`);
});

module.exports = app;
