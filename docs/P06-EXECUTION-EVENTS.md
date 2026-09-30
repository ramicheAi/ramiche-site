# P06 Packet 3: Execution + Cost Events

Base: `origin/main` at `6f10aad`. Status: implemented and verified locally. **The migration is NOT applied to any
database, and telemetry is OFF until `CC_EXECUTION_EVENTS=1` is set.**

## What it is

The Provider Adapter observes every AI execution (Claude Max, LM Studio, OpenClaw, and the Gemini / DeepSeek /
OpenRouter stream chain) and hands the FACTS to a separate server-only writer, `src/lib/execution-events.ts`,
which turns them into one `execution_events` row. The adapter never touches the database; the writer never calls
a model.

## Truth rules

Where each rule is enforced is stated per row. **[code]** means the application writer enforces it; **[DB]** means
a CHECK constraint or the view enforces it too, so a buggy or future writer cannot store a violating row. Rules
marked **[code]** only are NOT guaranteed by the database. The migration is deliberately not a policy engine: it
carries the cheap constraints that stop bad rows, and the rest lives in tested code.

| Rule | Enforced |
|---|---|
| Unknown is `null`. Never zero, never estimated. | [code] `normalizeUsage`; [DB] `usage_quality_matches_tokens` |
| A total is never derived from input + output. | [code] `normalizeUsage`; tests and mutation checks. Not a DB rule (no column can prove a total was not computed). |
| Claude Max `total_tokens` is always null. | [code] `normalizeUsage`; [DB] `claude_max_untrusted_counts` |
| Claude Max zero input/output is not a measurement: stored null. | [code] `normalizeUsage`; [DB] `claude_max_untrusted_counts` |
| Claude Max usage with no trustworthy number is UNKNOWN (`ambiguous_proxy_zero` if a zero was seen, else `not_reported`). | [code] `normalizeUsage`; [DB] `proxy_zero_is_claude_max_only`, `usage_quality_matches_tokens` |
| Token counts are integers in `0..2147483647`; anything else becomes null. | [code] `validCount` (an invalid value never reaches the insert); [DB] the column type is `integer` and rejects the rest |
| `model_requested` (exact) and `model_reported` (verbatim) are separate; the family label never replaces the exact model. | [code] `buildExecutionEvent`; tests and a mutation check |
| OpenClaw's model is unknown: both model columns null. | [code] `buildExecutionEvent`; [DB] `openclaw_model_unknown` |
| `direct_cost_usd` is null. Claude Max is a subscription, LM Studio is local. | [code] writer always writes null; [DB] `no_direct_cost_for_subscription_or_local` |
| Correlation is a typed pair: a valid UUID plus its type, or both null. Never truncated, never a type without an id. | [code] `validCorrelation`; [DB] `correlation_is_a_pair`, `correlation_id_is_uuid` |
| Shadow (list-price) cost is computed at read time only, priced as of the event, never stored, never called spend. | [DB] view `execution_events_with_shadow_cost` |
| No prompt, response, credential, authorization header or upstream error body is stored. | [code] the row shape has no field for them; tests scan stored rows and the health record. Not a DB rule. |

## Usage normalization

Invalid counts (non-integer, negative, above int4, non-number) are first treated as absent. Then:

| Provider input | Stored | `usage_quality` |
|---|---|---|
| no usable number | all null | `not_reported` |
| claude-max, input and output both absent or zero, and a zero was seen | all null | `ambiguous_proxy_zero` |
| claude-max, input and/or output > 0 | those fields as supplied; zero or missing ones null; **total always null** | `partial` |
| other provider, all three counts valid | as supplied | `provider_reported` |
| other provider, some but not all valid | as supplied; missing ones null (total NOT computed) | `partial` |

Why the Claude Max rule exists: `claude-max-api-proxy` v1.0.0 builds `usage` with `input_tokens || 0`, so a count the
CLI did not report becomes `0`, and it synthesizes `total_tokens` itself. A zero from that proxy is not a measurement,
and the proxy's total is its own sum, not an independent measurement, so neither is stored. A real non-zero count next
to a zero is kept; the zero is dropped. Claude Max rows are therefore `partial` at best, and the shadow-cost view
prices only rows with both input and output present. Other providers' zeros are values they reported and are kept.

## Model truth

The proxy reports a normalized family label (`claude-opus-4`, `claude-sonnet-4`, `claude-haiku-4`) and defaults it to
`claude-sonnet-4` when the CLI gave none. It is stored in `model_reported` as a hint. Pricing and attribution use
`model_requested`. OpenClaw's underlying model is unknown.

## Persistence and durability

`recordExecution` makes ONE attempt, bounded by `EXECUTION_EVENT_WRITE_TIMEOUT_MS` (1000 ms), and always resolves. A
failing, slow or absent database costs at most that bound; after 3 consecutive failures a circuit opens for 60 s and
writes are skipped without waiting. There are no retries. The execution id is generated before the call and used as
the primary key with `upsert ... onConflict id, ignoreDuplicates`, plus an in-process guard, so a repeat can never
create a second row. Health counters (`getExecutionTelemetryHealth`) make failures observable, including `correlationDropped` and `tokensDropped` (values rejected by validation) and `writeDuration` (`count`, `latestMs`, `p95Ms`, `maxMs` over a bounded sample of the last 50 attempts; a timed-out attempt counts as the 1000 ms bound; skipped writes record nothing). No dashboard reads it yet; error descriptions are
limited to a structured code or error name, never a message.

Mechanisms compared:

| Mechanism | Verdict |
|---|---|
| Next.js `after()` | Documented for Route Handlers, Server Components and Server Functions, with `waitUntil` on serverless. Verified to THROW outside a request scope ("`after` was called outside a request scope"). The adapter also runs in detached background work (`void runJob(...)`, lead-gen background generation), so it cannot be the one mechanism, and it would couple the adapter to the framework. |
| Fire-and-forget promise | Works on the persistent `next start` server, but loses events invisibly on any runtime that freezes after the response. |
| **Bounded awaited write (chosen)** | Finishes or times out before the adapter returns, on any runtime. Cost: normally one Supabase round trip on a multi-second model call; worst case 1 s, and the circuit breaker stops repeated waits. |

## Schema

`supabase/migrations/20260930000000_execution_events.sql`, rollback `supabase/rollbacks/20260930000000_execution_events.rollback.sql`,
SQL tests `supabase/tests/execution_events.test.sql`.

`execution_events` (RLS on, no policies, anon/authenticated revoked): `id` (uuid PK, generated by the app), `started_at`,
`latency_ms`, `provider`, `model_requested`, `model_reported`, `agent_id`, `purpose`, `outcome`, `error_class`,
`http_status`, `input_tokens`, `output_tokens`, `total_tokens`, `usage_quality`, `direct_cost_usd`, `billing_mode`,
`correlation_type`, `correlation_id`, `mission_id` (reserved, always null), `metadata` (`streamed`, `finish_reason`),
`created_at`. The cheap structural rules are CHECK constraints (see the table above for which ones); the rest is application code.

`model_pricing`: reference data with mandatory provenance (`source_url` non-blank, `retrieved_on` NOT NULL), seeded
with exactly three Anthropic records verified on 2026-09-30 against `https://platform.claude.com/docs/en/about-claude/pricing`:

| Model id | Input $/MTok | Output $/MTok | Cache read | 5m write | 1h write |
|---|---|---|---|---|---|
| `claude-opus-4-6` | 5 | 25 | 0.50 | 6.25 | 10 |
| `claude-sonnet-4-6` | 3 | 15 | 0.30 | 3.75 | 6 |
| `claude-haiku-4-5` | 1 | 5 | 0.10 | 1.25 | 2 |

The mapping from the page's names ("Claude Opus 4.6") to the app's ids is by naming convention. `effective_from` is unknown for the seeded rows.

**Pricing is point in time.** The view prices each event with the row in force on the event's UTC start date: the row with the greatest `coalesce(effective_from, retrieved_on)` that is `<=` that date; ties break on the later `retrieved_on`, and `(provider, model, retrieved_on)` is unique, so the choice is deterministic. Adding a newer price row never reprices an older execution. An event that predates every verified price row has NULL shadow cost (unknown), not the earliest price. `retrieved_on` is only a stand-in for the effective date when the true `effective_from` is unknown, so for the seeded rows executions dated before 2026-09-30 are unpriced.

`execution_events_with_shadow_cost` (view, `security_invoker`): `shadow_cost_usd` is produced only for a successful
claude-max call whose usage is `provider_reported` or `partial` with input AND output present, and whose exact
`model_requested` has a sourced price. Otherwise NULL (unknown, not zero). `shadow_cost_basis` is
`list_price_equivalent_lower_bound_excludes_cache_tokens`: the proxy drops cache-token counts, so this is a lower bound
and not billing precision. It is a list-price equivalent, never actual spend.

## Purpose set (derived mechanically from the call sites)

`agent-reply`, `strict-delegation-rewrite`, `synthesis`, `critique`, `refine`, `chat-stream`, `approve-execution`,
`voice`, `daily-verse`, `job`, `lead-gen`. A test fails if the set drifts from the purposes used in source, and another
if it drifts from the SQL CHECK list.

## Correlation mapping

| Path | `correlation_type` / `correlation_id` |
|---|---|
| chat (all 10 adapter calls) and chat stream | `chat_message` / the user's message id, only when the client sent one AND it is a UUID (otherwise both columns null and `correlationDropped` counts it) |
| jobs | `job` / the job id |
| lead-gen (intel, kit, call webhook) | `lead` / the lead id |
| voice/atlas, verse, approve-synthesis | null (no id is naturally available; none is manufactured) |

`mission_id` stays null until the Mission packet.

## Verification evidence

- SQL, on real PostgreSQL 18.3 (PGlite, run outside the repo, no repository dependency added): forward apply, idempotent
  re-apply, 15/15 SQL tests, rollback, idempotent re-rollback, re-apply. sha256:
  migration `fbb9d37f2815a365662e5a54c8307f33eecf06b6d995e3d69f9ca69ae2d24aaa`,
  rollback `705aa79b1fcbf719aa002b41e866b6f250ef6022cbb24e6fccc0fa83b487fa47` (unchanged),
  tests `a56391145c28c762289776cad91e7cdaa4763af142449096010e45b53ac1c7ce`.
- No SQL has been run against any remote project.

## Rollout (requires separate approval)

1. Review the SQL and its hash. 2. Apply through the reviewed manual path (as B3 was), never `supabase db push`, a schema
diff or a migration repair: B3's migration-history row is missing and those commands would misreport or reapply it.
3. Only then set `CC_EXECUTION_EVENTS=1` where telemetry should run. Until then the writer is a no-op, so merging is
decoupled from the database.

## Unknowns

- Whether the Claude Max proxy reports cache tokens inside `input_tokens` (assumed excluded; it is not forwarded).
- The model OpenClaw actually runs, and whether LM Studio, Gemini, DeepSeek or OpenRouter return usage in practice.
- Prices for Gemini, DeepSeek, OpenRouter and LM Studio (not verified, not seeded).
- Real per-call volume (hence no retention machinery in v1).
- `approve-execution` events carry no correlation id.
- Whether the remote `messages.id` column is a UUID (its table is not defined in this repository's migrations, and no remote SQL was run). If it is not, chat correlation stays null and `correlationDropped` will show it.

## Future packet (not started)

Expose the exact CLI model, cache-token counts and any trustworthy cost fields from the Claude Max proxy. The proxy is a
global npm package outside this repository and was not modified. With those fields, `ambiguous_proxy_zero` rows and the
shadow-cost lower bound could be replaced by real measurements.
