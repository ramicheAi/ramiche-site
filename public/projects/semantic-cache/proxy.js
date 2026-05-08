/**
 * proxy.js — Transparent Logging Proxy for OpenClaw → Claude Max API
 *
 * Sits between OpenClaw (consumer) and claude-max-api (provider on :3456).
 * Logs every request/response to the semantic cache cost-logger for analytics.
 * Supports both streaming (SSE) and non-streaming responses.
 *
 * Port: 3848 (configurable via PROXY_PORT env var)
 * Upstream: http://127.0.0.1:3456 (configurable via UPSTREAM_URL env var)
 */

'use strict';

const http = require('http');
const costLogger = require('./cost-logger');
const cacheEngine = require('./cache-engine');

const PROXY_PORT   = parseInt(process.env.PROXY_PORT || '3848', 10);
const UPSTREAM_HOST = process.env.UPSTREAM_HOST || '127.0.0.1';
const UPSTREAM_PORT = parseInt(process.env.UPSTREAM_PORT || '3456', 10);

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

function extractModelAndAgent(body) {
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    return {
      model: parsed.model || 'unknown',
      agent: parsed.metadata?.agent_name || parsed.user || 'unknown',
      sessionId: parsed.metadata?.session_id || 'default',
      messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
      stream: parsed.stream === true,
    };
  } catch {
    return { model: 'unknown', agent: 'unknown', sessionId: 'default', messageCount: 0, stream: false };
  }
}

function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 chars for English text
  return Math.ceil(text.length / 4);
}

/**
 * Strip system prompt boilerplate (RUNTIME GOVERNOR, project context, etc.)
 * from user messages so cache keys reflect only the actual user intent.
 */
function stripBoilerplate(text) {
  // Remove RUNTIME GOVERNOR blocks (injected into every agent message)
  text = text.replace(/## RUNTIME GOVERNOR[\s\S]*?(?=\n[^\s#]|\n## (?!RUNTIME)|$)/g, '');
  // Remove common system-injected sections
  text = text.replace(/## Response Policy[\s\S]*?(?=\n## |$)/g, '');
  text = text.replace(/## Narration Policy[\s\S]*?(?=\n## |$)/g, '');
  text = text.replace(/## Verification Policy[\s\S]*?(?=\n## |$)/g, '');
  text = text.replace(/## Silent Replies[\s\S]*?(?=\n## |$)/g, '');
  text = text.replace(/## Heartbeats[\s\S]*?(?=\n## |$)/g, '');
  text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  text = text.replace(/<previous_response>[\s\S]*?<\/previous_response>/g, '');
  // Collapse whitespace
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build a cache key from only the last user message + model.
 * Strips system prompt boilerplate for accurate matching.
 */
function buildCacheKey(rawBody) {
  try {
    const parsed = JSON.parse(rawBody);
    const model = parsed.model || 'unknown';
    const messages = parsed.messages || [];
    // Find last user message
    let lastUser = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUser = typeof messages[i].content === 'string'
          ? messages[i].content
          : JSON.stringify(messages[i].content);
        break;
      }
    }
    // Strip boilerplate so cache key reflects actual user intent
    lastUser = stripBoilerplate(lastUser);
    return `${model}::${lastUser}`;
  } catch {
    return rawBody;
  }
}

/**
 * Reconstruct a non-streaming response from buffered SSE chunks.
 */
function reconstructFromSSE(sseBuffer, model) {
  const lines = sseBuffer.split('\n');
  let content = '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') break;
    try {
      const chunk = JSON.parse(data);
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    } catch { /* skip malformed chunks */ }
  }
  if (!content) return null;
  return JSON.stringify({
    id: 'cache-reconstructed-' + Date.now(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: estimateTokens(content), total_tokens: estimateTokens(content) },
  });
}

const server = http.createServer((clientReq, clientRes) => {
  const startTime = Date.now();
  let requestBody = '';

  clientReq.on('data', chunk => { requestBody += chunk; });

  clientReq.on('end', () => {
    const info = extractModelAndAgent(requestBody);

    // --- Cache check (all /chat/completions, including streaming) ---
    if (clientReq.url?.includes('/chat/completions')) {
      const cacheKey = buildCacheKey(requestBody);
      const cached = cacheEngine.lookup(cacheKey);
      if (cached) {
        const inputTokens = estimateTokens(requestBody);
        const outputTokens = estimateTokens(cached.response);
        costLogger.logCall({
          model: info.model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_hit: true,
          agent_name: info.agent,
          session_id: info.sessionId,
          match_type: cached.matchType,
        });
        const cost = costLogger.computeCost(info.model, inputTokens, outputTokens);
        console.log(
          `[proxy] CACHE HIT (${cached.matchType}) | ${info.model} | ${info.agent} | saved $${cost.toFixed(4)}`
        );

        if (info.stream) {
          // Serve cached response as SSE stream
          clientRes.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
          const parsed = JSON.parse(cached.response);
          const content = parsed.choices?.[0]?.message?.content || '';
          const sseChunk = JSON.stringify({
            id: 'cache-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: info.model,
            choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: 'stop' }],
          });
          clientRes.write(`data: ${sseChunk}\n\n`);
          clientRes.write('data: [DONE]\n\n');
          clientRes.end();
        } else {
          clientRes.writeHead(200, { 'Content-Type': 'application/json' });
          clientRes.end(cached.response);
        }
        return;
      }
    }

    // Forward to upstream
    const proxyOptions = {
      hostname: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: { ...clientReq.headers, host: `${UPSTREAM_HOST}:${UPSTREAM_PORT}` },
    };

    const proxyReq = http.request(proxyOptions, (proxyRes) => {
      // Copy headers
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);

      let responseBody = '';

      proxyRes.on('data', chunk => {
        responseBody += chunk;
        clientRes.write(chunk);
      });

      proxyRes.on('end', () => {
        clientRes.end();

        const durationMs = Date.now() - startTime;
        const inputTokens = estimateTokens(requestBody);
        const outputTokens = estimateTokens(responseBody);

        // Log to cost-logger
        if (clientReq.url?.includes('/chat/completions')) {
          costLogger.logCall({
            model: info.model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_hit: false,
            agent_name: info.agent,
            session_id: info.sessionId,
            match_type: 'miss',
          });

          // Store in cache (all successful responses)
          if (proxyRes.statusCode === 200) {
            const cacheKey = buildCacheKey(requestBody);
            let storableResponse = responseBody;
            if (info.stream) {
              storableResponse = reconstructFromSSE(responseBody, info.model);
            }
            if (storableResponse) {
              cacheEngine.store(cacheKey, storableResponse, {
                model: info.model,
                agent: info.agent,
                input_tokens: inputTokens,
                output_tokens: outputTokens,
              });
            }
          }

          // Console summary
          const cost = costLogger.computeCost(info.model, inputTokens, outputTokens);
          console.log(
            `[proxy] ${info.model} | ${info.agent} | ${inputTokens}→${outputTokens} tokens | $${cost.toFixed(4)} | ${durationMs}ms | ${info.stream ? 'stream' : 'sync'}`
          );
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy] Upstream error:', err.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      }
      clientRes.end(JSON.stringify({ error: { message: `Upstream error: ${err.message}` } }));
    });

    proxyReq.write(requestBody);
    proxyReq.end();
  });
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(`[semantic-cache-proxy] Logging proxy running on http://127.0.0.1:${PROXY_PORT}`);
  console.log(`[semantic-cache-proxy] Forwarding to http://${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
  console.log(`[semantic-cache-proxy] Dashboard: http://localhost:3847`);
});
