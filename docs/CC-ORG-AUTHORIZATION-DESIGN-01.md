# CC-ORG-AUTHORIZATION-DESIGN-01

**Status:** Design document. CC-ORG-FOUNDATION-02 Phase B (channel authorization design), part of the organizational foundation named by the independent audit CC-ORG-INTELLIGENCE-01 (`ramiche-os` PR #51, not yet merged at time of writing).

**Scope of this PR:** documentation + one additive tag (`bootstrapMode: true`) + one dormant, provably-dead fail-closed code path + a migration *file* that is not applied. **No live behavior changes.** The table in §1 is almost entirely "documented, not changed" — see the "Changed by this PR" column.

**Companion lane:** `ramiche-os` is separately adding canonical org contracts (`department` / `venture_squad` / `channel_policy` / `appointment` JSON Schemas). This repo does not modify `ramiche-os`; this document cross-references `channel_policy.schema.json` by name and keeps field names aligned (`channel_ref`, `bootstrap_mode`, `principals[]` with `principal_id`/`role`/`permissions`/`valid_from`/`valid_until`) so the two repos describe the same concept without redefining it differently.

---

## 1. Authority matrix — every route under `src/app/api/command-center/`

**Baseline fact, true for every route below unless a column says otherwise:** authorization is "none beyond the Supabase `SUPABASE_SERVICE_ROLE_KEY` (which bypasses RLS) plus whatever the route itself checks." There is no platform-level session/role/permission system in front of this API surface. The app currently relies on network-level protection (the deployment sits behind Cloudflare Access for human users) rather than per-request authorization inside the route code. Say this plainly because it's true, not because it's acceptable long-term — see §4 for the gap.

Legend for **Changed by this PR**: `doc only` = listed here, zero code touched; `additive` = new optional field/param, default preserves exact current behavior; `dead code` = new branch exists but nothing exercises it yet.

| Path | Methods | What it does | Current authorization boundary | Changed by this PR |
|---|---|---|---|---|
| `activity/route.ts` | GET | Activity feed read | none beyond service-role key | doc only |
| `agents/route.ts` | GET, POST | Agent roster read/update | none beyond service-role key | doc only |
| `app-builder/route.ts` | GET | App-builder status | none beyond service-role key | doc only |
| `auth/pin/route.ts` | GET, POST | **The PIN gate itself** — sets the cockpit session cookie | PIN hash check (`CC_PIN_HASH`/`CC_PIN`); this *is* the auth boundary for human UI access, not absent | doc only |
| `bambu/route.ts` | GET, POST | 3D-printer (Bambu) status/control proxy | none beyond service-role key | doc only |
| `briefing/compose/route.ts` | POST, GET | Daily briefing composition | none beyond service-role key | doc only |
| `calendar/route.ts` | GET | Calendar read | none beyond service-role key | doc only |
| `chat/action-status/route.ts` | GET, POST | Phase D: action status on a synthesis plan | none beyond service-role key | doc only |
| `chat/approve/route.ts` | GET, POST | Phase C: synthesis approval + handoff dispatch | none beyond service-role key | doc only |
| `chat/approve/stream/route.ts` | POST, GET | Streaming Phase C+F approval (SSE) | none beyond service-role key | doc only |
| `chat/decisions/route.ts` | GET | Phase D decisions feed | none beyond service-role key | doc only |
| `chat/health/route.ts` | GET | Chat subsystem health check | none beyond service-role key | doc only |
| `chat/mark-read/route.ts` | POST | Mark a user message read | none beyond service-role key | doc only |
| `chat/pin/route.ts` | POST | Pin a chat message | none beyond service-role key | doc only |
| `chat/pulse/route.ts` | GET | Chat "pulse"/presence signal | none beyond service-role key | doc only |
| `chat/reactions/route.ts` | POST | Add/remove a message reaction | none beyond service-role key | doc only |
| `chat/regenerate-image/route.ts` | POST, GET | Regenerate one inline image | none beyond service-role key | doc only |
| **`chat/route.ts`** | GET, POST | **The main chat relay** — orchestrates agent replies, calls `resolveChatTargets()` | none beyond service-role key; `resolveChatTargets()` trusts client-submitted `channelMembers` directly (the finding this mission is about — see §3) | **additive**: accepts optional `bootstrapMode` (default `true`); behavior unchanged for every real caller today |
| `chat/search/route.ts` | GET | Message search | none beyond service-role key | doc only |
| **`chat/stream/route.ts`** | POST | SSE single-target chat relay (sibling to `chat/route.ts`) | same as `chat/route.ts` | **additive**: same `bootstrapMode` param, same default, not currently exercised by any frontend caller |
| `chat/upload/route.ts` | POST | File upload into chat | none beyond service-role key | doc only |
| `chat/webhook/route.ts` | POST | Inbound webhook into chat | **has a real check**: requires `Authorization: Bearer <token>`, rejects with 401 otherwise | doc only |
| `content/route.ts` | GET | Content calendar read | none beyond service-role key | doc only |
| `crons/route.ts` | GET, POST | Cron CRUD, proxied to OpenClaw/Firestore | GET: none. POST: **has a real check** — requires `x-bridge-secret` header to equal `BRIDGE_API_SECRET`, else 401 | doc only |
| `docs/route.ts` | GET | Docs listing | none beyond service-role key | doc only |
| `export/route.ts` | GET | Data export | none beyond service-role key | doc only |
| `firestore-read/route.ts` | GET | Read Firestore-synced data (Vercel path) | none beyond service-role key | doc only |
| `firestore-sync/route.ts` | GET, POST | Sync local filesystem data to Firestore | none beyond service-role key | doc only |
| `gate/route.ts` | GET, POST | The Approval Gate (one-click queue for the autonomous Growth Loop) | none beyond service-role key — **this is the one place a human founder-gate decision is supposed to live; today nothing stops a request from hitting it directly without going through the UI gate** | doc only (flagged in §4) |
| `image-gen/route.ts` | GET, POST | Image generation | none beyond service-role key | doc only |
| `jobs/route.ts`, `jobs/[id]/route.ts` | GET, POST | Job CRUD/status | none beyond service-role key | doc only |
| `leads/intel/route.ts`, `leads/kit/route.ts`, `leads/send/route.ts` | POST | Lead intel / kit generation / **send** (outreach) | none beyond service-role key — **`leads/send` is a public-facing-content send path; see §4, this is a Business Bible hard-gate category (sending to real people) that has no in-code gate today** | doc only (flagged in §4) |
| `memory/route.ts` | GET | Memory store read | none beyond service-role key | doc only |
| `meridian/route.ts` | GET | MERIDIAN venture data | none beyond service-role key | doc only |
| `oracle/route.ts` | POST | ORACLE (finance agent) proxy | none beyond service-role key (uses an upstream `x-api-key` outbound, not an inbound check) | doc only |
| `pipeline/diagnose/route.ts`, `pipeline/funnel/route.ts`, `pipeline/icp/route.ts`, `pipeline/leads/route.ts`, `pipeline/maintenance/route.ts`, `pipeline/proposals/route.ts` | GET/POST (varies) | Sales pipeline read/diagnostics/maintenance | none beyond service-role key | doc only |
| `projects/route.ts` | GET | Project list | none beyond service-role key | doc only |
| `prospector/daily/route.ts`, `prospector/import/route.ts`, `prospector/search/route.ts` | GET/POST | Lead prospecting | none beyond service-role key | doc only |
| `push/route.ts` | POST, GET | Push notification dispatch | **has a real check**: requires `x-cc-push-secret` header (or `Authorization: Bearer <secret>`) | doc only |
| `revenue/route.ts` | (alias) | Alias of `stripe-revenue` | none beyond service-role key | doc only |
| `roadmap/route.ts` | GET, POST | Roadmap read/update | none beyond service-role key | doc only |
| `security/route.ts` | POST | Security self-check (probes other routes for 401/403) | none beyond service-role key | doc only |
| `settings/route.ts` | GET, POST | Settings read/update | none beyond service-role key | doc only |
| `sse/route.ts` | GET | Generic SSE stream | none beyond service-role key | doc only |
| `stripe-revenue/route.ts` | GET | Stripe MRR/charges/payouts | none beyond service-role key | doc only |
| `tasks/notify/route.ts` | POST | Task notification | none beyond service-role key | doc only |
| `telegram/webhook/route.ts` | POST, GET | Inbound Telegram webhook | **has a real check**: `verifyTelegramWebhookSecret(req)`, 401 otherwise | doc only |
| `voice/atlas/route.ts` | POST | "Talk to Atlas" voice loop endpoint | none beyond service-role key | doc only |
| `voice/call-list/route.ts` | GET | Outbound call list | none beyond service-role key | doc only |
| `voice/call/route.ts`, `voice/call/webhook/route.ts` | POST | Outbound voice call (Vapi) + its webhook | none beyond service-role key — **outbound calling is a Business Bible/TCPA-relevant action; see §4** | doc only (flagged in §4) |
| `voice/metrics/route.ts` | GET | Voice metrics | none beyond service-role key | doc only |
| `voice/speak/route.ts`, `voice/transcribe/route.ts` | POST | TTS / STT | none beyond service-role key | doc only |
| `wellness/verse/route.ts` | GET, POST | Daily verse | none beyond service-role key | doc only |
| `ws/route.ts` | GET, POST | WebSocket bridge | none beyond service-role key | doc only |
| `yolo-approve/route.ts` | POST | YOLO build approval | none beyond service-role key | doc only |
| `yolo-builds/route.ts`, `yolo-builds/preview/[...path]/route.ts` | GET | YOLO build listing/preview | none beyond service-role key | doc only |

**Summary:** of ~70 route files, 5 have any inbound request-level check at all (`auth/pin`, `chat/webhook`, `crons` POST, `push`, `telegram/webhook`), each a bespoke shared-secret/PIN/signature check with no shared middleware. Everything else is open to anything that can reach the deployed URL and knows the request shape, protected only by Cloudflare Access at the network edge (outside this repo) and by the service-role key never being exposed client-side. This PR changes none of that; it documents it so CC-ORG-FOUNDATION-02's later phases have an accurate starting map instead of an assumed one.

---

## 2. Discuss / Execute / Review modes (from CC-ORG-INTELLIGENCE-01)

Three distinct modes a channel-scoped action can run in. None of today's routes are tagged with a mode yet — this section defines the vocabulary the authority matrix above will eventually be annotated with, once `channel_principal`/`channel_policy` exists to enforce it.

- **Discuss** — no side effects. Reading, chatting, asking a question, drafting. The overwhelming majority of the table in §1 is Discuss-shaped today (reads, chat relay, drafting), even where the route *could* theoretically be called to do more.
- **Execute** — a side-effecting action. Requires: a mission id, an action id, an owner, acceptance criteria, an idempotency key, and a resource allowance. Side-effecting actions additionally require a founder (Ramon) gate before they run. `gate/route.ts` is the intended checkpoint for this today, but as noted in §1 and §4, nothing currently forces a request to go through it — a caller could hit the underlying action route directly.
- **Review** — independent of execution. A reviewer evaluates an already-executed (or proposed) action without being the one who executed it, and without the ability to re-execute it themselves by virtue of reviewing. `security/route.ts` (self-check) is adjacent to this but is automated, not a principal-based review.

A future `channel_principal` row's `permissions` array (see §3) is how a principal's allowed modes per channel will be expressed: `discuss`, `propose`, `execute`, `approve`, `review`, `read`, `administer`.

---

## 3. The `channel_principal` / `bootstrap_mode` model

**The finding this mission starts from** (verified facts, not re-derived — see §5 for independent re-verification):

- `src/lib/chat-routing.ts`'s `resolveChatTargets()` trusts a client-submitted `channelMembers` array with **no server-side membership check**. Whatever array the browser sends in the POST body becomes the set of agents that get to respond and (via downstream execution paths) act.
- The *only* source of that array today is `DEFAULT_CHANNELS` in `src/app/command-center/chat/page.tsx` — a hardcoded array baked into the client bundle. A real "membership" concept (who is actually allowed to be a principal in a channel, with what role and what permissions) does not exist anywhere server-side.
- Every route in §1 uses the Supabase service-role key, which bypasses RLS entirely. RLS is therefore not today's authorization boundary for any of this; application code (or its absence) is.

**The model, matching `ramiche-os`'s `channel_policy.schema.json` conceptually:**

A channel has a `channel_ref` (advisory — no enforced foreign key, so a policy can exist for a channel that doesn't have a `channels` row yet, or can outlive one) and a `bootstrap_mode: boolean`. While `bootstrap_mode` is true, there is no enforced principal list — membership is whatever the client/frontend says it is (today: `DEFAULT_CHANNELS[*].members`). Once a channel is explicitly flipped to non-bootstrap, membership must come from a real, server-verified `principals[]` list: `{principal_id, role: owner|member|reviewer|observer|bot, permissions: subset of [read,discuss,propose,execute,approve,review,administer], valid_from, valid_until}`.

**What this PR actually ships toward that model** (dormant, not live):

1. `DEFAULT_CHANNELS` entries are tagged `bootstrapMode: true` (additive field; see §1 "additive" rows). This is purely declarative today — nothing reads it to change behavior yet except the plumbing in point 2.
2. `resolveChatTargets()` in `chat-routing.ts` gained a `bootstrapMode` parameter (default `true`, preserving every existing call site and every existing test byte-for-byte) and a `resolvedMembers` parameter. When `bootstrapMode === false`, the client-submitted `channelMembers` is **not** consulted at all — only `resolvedMembers` (intended to come from a future server-side `channel_principal` lookup) can resolve targets, and the function returns `[]` if none are given, rather than silently falling back to `"atlas"` (a silent fallback would mask a missing-lookup bug as normal behavior — see the decision note in the code comment).
3. `route.ts` and `stream/route.ts` both accept an optional `bootstrapMode` in the request body and pass it through, defaulting to `true`. No frontend caller sends anything but the implicit default today (`page.tsx` does send it now, always computed as `true` from `DEFAULT_CHANNELS`), so this is provably dead-but-correct: no real channel exercises the `false` branch.
4. A `channel_principal` table is defined in a migration file (not applied — see §5) shaped to match the `principals[]` entries above, with `channel_id` referencing `channels(id)` (loosely — see the migration's own comment on why it's not a hard dependency on bootstrap semantics the way `channel_ref` is advisory in the schema), RLS enabled, deny-by-default.

**What is intentionally NOT built here:** the actual `channel_principal` population/lookup (nothing writes to or reads from that table), any UI for managing channel membership, and any enforcement that flips a channel out of bootstrap mode. Those are follow-up work once `ramiche-os`'s `channel_policy` schema lands and a decision is made about which channels graduate out of bootstrap first (the Verified Agents channel — see §5 — is the obvious first non-bootstrap candidate once its `channel_members` anomaly is fixed, since `channel_policy`'s seed data deliberately skips it today for the same reason).

---

## 4. Gaps this document surfaces but does not fix (flagged, not actioned)

- **`gate/route.ts`** is supposed to be Ramon's founder-gate checkpoint for the autonomous Growth Loop, but nothing in the route table forces an Execute-mode action through it — a caller that knows the underlying action route can bypass the gate entirely. This is exactly the kind of side-effecting-action-needs-a-founder-gate requirement the Execute mode (§2) is meant to enforce once channel_principal exists.
- **`leads/send/route.ts`** and **`voice/call/route.ts`** are outreach-to-real-people paths (Business Bible: "sending public content or real outreach to real people — drafts auto-prepared, sending is gated" / TCPA-relevant for voice) with no in-code gate distinguishing a draft from a send. This is a pre-existing condition, not something introduced or touched by this PR; flagging it here is the "outside-in verification" discipline (if a third party receives it, our own tests passing isn't the acceptance bar) applied to the authority matrix itself.
- **No shared authorization middleware** exists; the 5 routes with any check each implement their own bespoke header/secret comparison. A `channel_principal`-aware middleware is the natural consolidation point once that table is real, but building it is out of scope for Phase B.

None of the above is changed by this PR. They are named so CC-ORG-FOUNDATION-02's next phase starts from an accurate list instead of rediscovering them.

---

## 5. Live-database findings — independently re-verified 2026-11-08

All of the below were re-run directly against the live `command-center-hq` Supabase project (`qkbkfsjkysdsfmhgfdoc`) via read-only `SELECT`, not taken on faith from the task brief. No `apply_migration`, no write SQL, was run against this project by this agent.

**Row counts** (match the brief exactly): `agent_profiles`=21, `channels`=46, `channel_members`=5, `messages`=425, `missions`=1, `mission_events`=4, `mission_links`=2, `jobs`=3, `execution_events`=22.

**RLS-enabled-with-zero-policy tables** (confirmed, exactly the 18 named in the brief): `agent_profiles, channel_members, channels, daily_verses, execution_events, job_events, jobs, message_reactions, messages, mission_events, mission_links, missions, model_pricing, pipeline_events, pipeline_gate, pipeline_leads, pipeline_proposals, tenants`.

**Duplicate channel names — the brief undercounted.** Querying `channels` grouped by exact `name` turned up **8** March-era-orphan-vs-May-era-real-channel pairs, not the 6 named in the brief:

| Name | Orphan id (2026-03-12) | Real id (2026-05-13) | In brief? |
|---|---|---|---|
| Security Team | `bb000001-...` | `77777777-...` | yes |
| Finance Team | `bb000002-...` | `88888888-...` | yes |
| Sales Team | `bb000003-...` | `99999999-...` | yes |
| Strategy Team | `bb000004-...` | `aaaaaaaa-...` | yes |
| Legal Team | `bb000005-...` | `bbbbbbbb-...` | yes |
| **Content Team** | `bb000006-...` | `cccccccc-...` | **no — missed by the brief** |
| Wellness Team | `bb000007-...` | `dddddddd-...` | yes |
| **Creative Team** | `bb000008-...` | `ffffffff-...` | **no — missed by the brief** |

Both missed pairs are real, currently-wired channels (`DEFAULT_CHANNELS` uses `cccccccc-...` for `#content-team` and `ffffffff-...` for `#creative-team`), so they matter exactly as much as the 6 the brief named. The duplicate-detector test fixture (`src/lib/channel-authz.test.ts`) uses the corrected set of 8.

**A 9th duplicate, found during this re-verification and out of scope for this PR:** `"DM: Triage"` exists twice — `aa000002-0000-0000-0000-000000000000` (2026-03-12, the real DM channel per `cc-agent-dm-uuids.ts`/`AGENT_CORE`) and `4a6cfad8-0e8a-4f5e-a383-fc05acb517da` (created 2026-10-03). This does **not** fit the March-orphan/May-real pattern — it's a DM channel, not a team channel, and the duplicate is recent, not a leftover from the original March seed. It is **not** included in the `archived_at` candidate list in the migration file, and is reported here rather than remediated, per this mission's "report it, don't fix it" instruction for anomalies outside the stated scope. Recommend a separate, narrowly-scoped follow-up to investigate why a second "DM: Triage" row was created in October and whether any messages are split across the two.

**The `channel_members` anomaly — confirmed exactly as described.** All 5 rows are for `channel_id = 55555555-...` ("Verified Agents"). Their `agent_id` values are `aaaaaaaa-...`, `bbbbbbbb-...`, `cccccccc-...`, `dddddddd-...`, `eeeeeeee-...` — these are the **team-channel UUIDs** (Strategy, Legal, Content, Wellness, Studio respectively), not real agent ids (a real agent id looks like `aa0000NN-0000-0000-0000-000000000000` per `AgentCore.dmUuid`). This looks like a data-entry or migration error — plausibly someone copy-pasted channel ids into what should have been agent ids while seeding this table. **Not fixed here** (forbidden — it's live data — and fixing it blind, without knowing what the original intent was, risks inventing a wrong "fix"). This is why `ramiche-os`'s `channel_policy` seed data deliberately skips a `channel_policy` record for "Verified Agents": the live membership data for that channel cannot be trusted to seed anything from.

**Grants, beyond what the brief covered:** independently checked role grants (not just RLS-policy presence) for `channels`, `channel_members`, `agent_profiles`, `messages`, `missions`, `jobs`, `execution_events`. `channels`/`channel_members`/`agent_profiles`/`messages` have zero `anon`/`authenticated` grants (revoked by the 2026-09-28 `p05b3_cockpit_anon_lockdown` migration). `missions`/`execution_events` have zero such grants and appear to never have had any. **`jobs` is the exception**: it still carries full `SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` grants for both `anon` and `authenticated` — left in place by that same 2026-09-28 migration's own stated decision ("already deny anon via RLS-without-policy; grants left as-is to avoid changing error semantics for existing callers"). RLS-with-no-policy already denies all rows regardless, so this is not a live vulnerability today, but it is the one table where a future accidental permissive policy would have an unusually wide blast radius. This is why the migration file's proposed (not applied) section explicitly calls out revoking `jobs`' grants before adding a policy there, unlike the other 6 in-scope tables which only need the policy.

---

## 6. Test plan (see `src/lib/chat-routing.test.ts`, `src/lib/channel-authz.test.ts`, `src/app/command-center/chat/default-channels.test.ts`)

- Every existing `resolveChatTargets()` test case, run with `bootstrapMode` omitted and with `bootstrapMode: true`, returns byte-for-byte the same result as before this change.
- `bootstrapMode: false` never falls through to client-submitted `channelMembers`; without `resolvedMembers` it returns `[]`; with `resolvedMembers` it uses only those.
- Every `DEFAULT_CHANNELS` member id resolves against `chatAgentIds()` (a real regression check — would have caught a typo'd agent id in a team channel).
- The duplicate-channel-name detector, run against a fixture built from the independently re-verified live data (§5), finds exactly the 8 real pairs and nothing else — including a case-sensitivity check and an empty-input case.
