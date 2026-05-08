/**
 * cache-engine.js — Semantic Cache Engine for OpenClaw
 *
 * Provides prompt-level caching with two lookup strategies:
 *   1. Exact match via SHA-256 hash of normalized text
 *   2. Fuzzy match via cosine similarity on TF-IDF vectors (no external ML deps)
 *
 * Cache entries are persisted to a local JSON file and expire after a
 * configurable TTL (default: 1 hour).
 *
 * Exports:
 *   lookup(prompt)                  — Returns cached response or null
 *   store(prompt, response, meta)   — Writes a new cache entry
 *   stats()                         — Returns hit/miss/eviction counters
 *   clear()                         — Wipes the entire cache
 *   evictExpired()                  — Removes stale entries
 */

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CACHE_DIR          = path.join(__dirname, 'data');
const CACHE_FILE         = path.join(CACHE_DIR, 'cache-store.json');
const DEFAULT_TTL_MS     = 24 * 60 * 60 * 1000;     // 24 hours
const SIMILARITY_THRESHOLD = 0.90;                   // cosine similarity floor (safe now that proxy strips boilerplate before keying)
const MAX_CACHE_ENTRIES  = 10_000;                   // hard cap to prevent unbounded growth

// Runtime counters (reset on process restart)
let counters = { hits: 0, misses: 0, fuzzyHits: 0, evictions: 0, stores: 0 };

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the data directory exists and load the cache from disk.
 * Returns a plain object keyed by SHA-256 hash.
 */
function loadCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(CACHE_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[cache-engine] Failed to load cache:', err.message);
    return {};
  }
}

/**
 * Atomically write the cache object to disk.
 */
function saveCache(cache) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const tmp = CACHE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf-8');
    fs.renameSync(tmp, CACHE_FILE);
  } catch (err) {
    console.error('[cache-engine] Failed to save cache:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Text normalization & hashing
// ---------------------------------------------------------------------------

/**
 * Normalize a prompt string for consistent hashing:
 *   - lowercase
 *   - collapse whitespace
 *   - trim
 *   - strip trailing punctuation sequences
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim();
}

/**
 * SHA-256 hex digest of the normalized prompt.
 */
function hashPrompt(prompt) {
  return crypto
    .createHash('sha256')
    .update(normalize(prompt))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// TF-IDF / Cosine similarity (zero-dependency)
// ---------------------------------------------------------------------------

/**
 * Tokenize text into an array of lowercase alphanumeric words.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Build a term-frequency map for a list of tokens.
 */
function termFrequency(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  // normalize by total token count
  const len = tokens.length || 1;
  for (const t of Object.keys(tf)) {
    tf[t] /= len;
  }
  return tf;
}

/**
 * Compute cosine similarity between two TF vectors.
 */
function cosineSimilarity(vecA, vecB) {
  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const term of allTerms) {
    const a = vecA[term] || 0;
    const b = vecB[term] || 0;
    dot  += a * b;
    magA += a * a;
    magB += b * b;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Look up a cached response for the given prompt.
 *
 * Strategy:
 *   1. Try exact hash match (fast path).
 *   2. Fall back to cosine similarity scan across all non-expired entries.
 *
 * @param  {string} prompt           — The user/agent prompt text.
 * @param  {object} [options]
 * @param  {number} [options.ttl]    — Custom TTL in ms for expiry check.
 * @param  {number} [options.threshold] — Custom similarity threshold (0-1).
 * @returns {{ response: string, metadata: object, matchType: string } | null}
 */
function lookup(prompt, options = {}) {
  const ttl       = options.ttl       || DEFAULT_TTL_MS;
  const threshold = options.threshold || SIMILARITY_THRESHOLD;
  const cache     = loadCache();
  const now       = Date.now();
  const hash      = hashPrompt(prompt);

  // --- Exact match ---
  if (cache[hash]) {
    const entry = cache[hash];
    if (now - entry.created_at < (entry.ttl || ttl)) {
      entry.last_hit = now;
      entry.hit_count = (entry.hit_count || 0) + 1;
      saveCache(cache);
      counters.hits++;
      return {
        response:  entry.response,
        metadata:  entry.metadata || {},
        matchType: 'exact',
        hash,
      };
    }
    // Expired — remove it
    delete cache[hash];
    saveCache(cache);
    counters.evictions++;
  }

  // --- Fuzzy matching DISABLED ---
  // Fuzzy/cosine similarity matching is permanently disabled because agent
  // requests share large system prompt boilerplate (RUNTIME GOVERNOR, etc.)
  // that dominates TF-IDF vectors, causing nearly ALL requests to false-match.
  // Only exact SHA-256 hash matches are used. This is safe and correct —
  // identical prompts still get cached, and different prompts always go to Claude.
  counters.misses++;
  return null;
}

/**
 * Store a prompt→response pair in the cache.
 *
 * @param {string} prompt    — The original prompt text.
 * @param {string} response  — The LLM response to cache.
 * @param {object} [metadata] — Arbitrary metadata (model, tokens, agent, etc.).
 * @param {object} [options]
 * @param {number} [options.ttl] — Per-entry TTL override in ms.
 */
function store(prompt, response, metadata = {}, options = {}) {
  const cache = loadCache();
  const hash  = hashPrompt(prompt);

  cache[hash] = {
    prompt:     prompt,
    response:   response,
    metadata:   metadata,
    created_at: Date.now(),
    last_hit:   null,
    hit_count:  0,
    ttl:        options.ttl || DEFAULT_TTL_MS,
  };

  // Enforce max size — evict oldest entries first
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    const sorted = keys.sort((a, b) => cache[a].created_at - cache[b].created_at);
    const toEvict = sorted.slice(0, keys.length - MAX_CACHE_ENTRIES);
    for (const k of toEvict) {
      delete cache[k];
      counters.evictions++;
    }
  }

  saveCache(cache);
  counters.stores++;

  return { hash, stored: true };
}

/**
 * Return cache statistics.
 */
function stats() {
  const cache       = loadCache();
  const now         = Date.now();
  let totalEntries  = 0;
  let expiredCount  = 0;
  let totalHits     = 0;

  for (const entry of Object.values(cache)) {
    totalEntries++;
    totalHits += entry.hit_count || 0;
    if (now - entry.created_at >= (entry.ttl || DEFAULT_TTL_MS)) {
      expiredCount++;
    }
  }

  return {
    totalEntries,
    activeEntries:  totalEntries - expiredCount,
    expiredEntries: expiredCount,
    totalStoredHits: totalHits,
    session: { ...counters },
    hitRate: counters.hits + counters.misses > 0
      ? ((counters.hits / (counters.hits + counters.misses)) * 100).toFixed(1) + '%'
      : 'N/A',
  };
}

/**
 * Remove all expired entries from the cache.
 * @returns {number} Number of entries evicted.
 */
function evictExpired() {
  const cache   = loadCache();
  const now     = Date.now();
  let evicted   = 0;

  for (const [key, entry] of Object.entries(cache)) {
    if (now - entry.created_at >= (entry.ttl || DEFAULT_TTL_MS)) {
      delete cache[key];
      evicted++;
      counters.evictions++;
    }
  }

  if (evicted > 0) saveCache(cache);
  return evicted;
}

/**
 * Wipe the entire cache.
 */
function clear() {
  saveCache({});
  counters = { hits: 0, misses: 0, fuzzyHits: 0, evictions: 0, stores: 0 };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  lookup,
  store,
  stats,
  clear,
  evictExpired,
  hashPrompt,
  normalize,
  // Exposed for testing
  _cosineSimilarity: cosineSimilarity,
  _termFrequency:    termFrequency,
  _tokenize:         tokenize,
};
