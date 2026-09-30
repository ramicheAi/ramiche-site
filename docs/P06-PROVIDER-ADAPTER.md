# P06 Packet 2: Provider Adapter

Server-only module: `src/lib/provider-adapter.ts`. Base: `origin/main` at `d73add0`.

This is an execution-consolidation packet, not a routing change. Which provider is tried, in what
order, with which prompt, tokens, temperature and timeout is still decided by the callers, exactly
as before. The adapter owns request construction, model resolution and result normalisation.

## Provider execution inventory

| # | Site (file:function) | Provider | Model source | Stream | Fallback / timeout | Active? | Now |
|---|---|---|---|---|---|---|---|
| 1 | `chat/route.ts` `generateAgentReply` | OpenClaw `sessions_send` | unknown (OpenClaw config) | no | only if `OPENCLAW_CHAT_PRIMARY`; 25s; strict mode returns 502 | yes (opt-in) | adapter |
| 2 | `chat/route.ts` `generateAgentReply` | claude-max proxy | registry tier -> env override | no | 45s; then LM Studio | yes (default) | adapter |
| 3 | `chat/route.ts` `generateAgentReply` | LM Studio | `CC_LMSTUDIO_MODEL` or none | no | 60s; last resort | yes | adapter |
| 4 | `chat/route.ts` `regenerateAtlasDelegationReply` | claude-max | atlas tier | no | 45s, no fallback | yes (`CC_STRICT_DELEGATION`) | adapter |
| 5 | `chat/route.ts` `generateSynthesis` / `refineSynthesis` | claude-max, then LM Studio | atlas tier | no | 60s / 75s | yes (group chat) | adapter |
| 6 | `chat/route.ts` `generateCritique` | claude-max, then LM Studio | atlas tier | no | 45s / 60s | yes (group chat) | adapter |
| 7 | `chat/stream/route.ts` | OpenClaw | unknown | no (replayed as one chunk) | tried whenever gateway configured (not gated by `OPENCLAW_CHAT_PRIMARY`); 90s | route reachable, **no in-repo caller** | adapter |
| 8 | `chat/stream/route.ts` | Gemini `gemini-2.0-flash` | fixed | **SSE** | 45s; then DeepSeek | as above | adapter |
| 9 | `chat/stream/route.ts` | DeepSeek `deepseek-chat` | fixed | **SSE** | 45s; then OpenRouter | as above | adapter |
| 10 | `chat/stream/route.ts` | OpenRouter `anthropic/claude-sonnet-4` | fixed | **SSE** | 45s; then error event | as above | adapter |
| 11 | `cc-approve-synthesis.ts` `dispatchExecution` | OpenClaw (primary flag), claude-max, LM Studio | owner's tier; LM none | no | 90s / `DISPATCH_TIMEOUT_MS` / +15s | yes (approve flow) | adapter |
| 12 | `cc-approve-synthesis.ts` `runVerifier` | claude-max | atlas tier | no | `VERIFIER_TIMEOUT_MS`, no fallback | yes | adapter |
| 13 | `voice/atlas/route.ts` | claude-max | `ATLAS_MODEL` or `claude-sonnet-4-5` | no | 45s abort, no bearer token | yes (Sanctuary UI) | **left** |
| 14 | `wellness/verse/route.ts` | claude-max | `CC_VERSE_MODEL` or `claude-sonnet-4-6` | no | none | yes (DailyVerse UI) | **left** |
| 15 | `lib/jobs.ts` `runJob` | claude-max | job input / `CC_JOBS_MODEL` / `claude-sonnet-4-5` | no | 15 min, no bearer token, no system message | yes | **left** |
| 16 | `lib/lead-gen.ts` `callProxyJSON` | claude-max | `opts.model` or `claude-sonnet-4-5` | no | 180s, one JSON-parse retry | yes (3 callers) | **left** |
| 17 | `briefing/compose/route.ts` | OpenClaw via gateway | unknown | no | 30s; deterministic fallback | yes | **left** |
| 18 | `oracle/route.ts` | Anthropic native Messages API | literal `claude-sonnet-4-20250514` | no | none | **dead** (no caller) | **left** |
| 19 | `PageAgentWidget.tsx` | Ollama `qwen3:8b` at a LAN IP, via `page-agent` | literal | no | n/a | **dead** (not mounted) | **left** |
| 20 | `voice/transcribe`, `image-gen/{openai,gemini}` | Whisper / image models | env/literal | no | 10s / 90s | yes | **left** (not chat completions) |

No path reads token usage at base: every parse discards `usage`. After this packet the migrated paths
capture it when the provider sends it (see below).

## Duplication and conflicts

| Duplicate | Where | Resolution |
|---|---|---|
| tier -> model resolver (`modelForAgent`) | `chat/route.ts`, `cc-approve-synthesis.ts` (identical) | one `claudeModelForAgent()` in the adapter, tiers from the registry |
| `cleanEnv` | `chat/route.ts`, `cc-approve-synthesis.ts` (identical) | exported from the adapter |
| claude-max fetch + parse | 5 sites in chat route, `callClaudeMax` in approve | `executeCompletion({provider:"claude-max"})` |
| LM Studio fetch + parse | 4 sites in chat route, `callLMStudio` in approve | `executeCompletion({provider:"lm-studio"})` |
| streaming generators | `geminiStream`, `openaiStyleStream` in stream route | `streamCompletion()` |
| OpenClaw send | 3 sites | `executeOpenClaw()` |
| claude-max fetch (different auth/timeouts/models/parse) | voice/atlas, verse, jobs, lead-gen | **not merged**: each differs in bearer token, env-read timing, model default, timeout and parse. Left as a later packet. |

Known divergences that are preserved on purpose, not fixed here:
- The streaming route never uses claude-max or LM Studio; the chat route never uses Gemini, DeepSeek or OpenRouter.
- The streaming route tries OpenClaw whenever the gateway is configured; the chat route only with `OPENCLAW_CHAT_PRIMARY`.
- LM Studio in `cc-approve-synthesis` never pins a model; in the chat route it honours `CC_LMSTUDIO_MODEL`.
- OpenRouter is still executable in the stream route. It is preserved and unreordered. The route has no in-repo caller, so removing it is a later, explicit cleanup packet.

## Contract

```ts
executeCompletion(req: { provider: "claude-max" | "lm-studio"; model?; messages; maxTokens; temperature;
                         timeoutMs; captureErrorBody?; context? })
  -> { ok: true,  provider, model /*requested*/, text: string | null, finishReason?, usage?, httpStatus, latencyMs }
   | { ok: false, provider, model, kind: "http" | "exception", httpStatus?, bodySnippet?, error?: unknown, latencyMs }

streamCompletion(req: { provider: "gemini" | "deepseek" | "openrouter"; apiKey; systemPrompt; userMessage; context? })
  -> { provider, model, deltas: AsyncGenerator<string>, outcome: { httpStatus?, usage?, latencyMs? } }

executeOpenClaw(req: { sessionKey; message; timeoutSeconds; context? })
  -> { ok: true, provider: "openclaw", model: "unknown", text, latencyMs } | { ok: false, ..., error }

claudeModelForAgent(id) / claudeModelForTier(tier) / lmStudioModel() / cleanEnv(name)
```

`usage` is present only when the provider returned numeric token counts, and only the fields it
returned. Totals are never computed. OpenClaw returns no usage and its model stays `unknown`.

## Not in this packet

Cost dashboards and telemetry sinks (Packet 3), fan-out changes, provider policy changes, removal of
OpenRouter or of the dead oracle/PageAgentWidget code, the four peripheral claude-max callers
(voice/atlas, verse, jobs, lead-gen), OpenClaw briefing compose, transcription and image generation.

## Unknowns

- The model actually used when OpenClaw serves a reply.
- Whether claude-max supplies `usage` in practice (captured if present; none is assumed).
- Whether anything outside this repo calls `chat/stream`.
