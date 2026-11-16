# Parallax OS Command Center implementation-ready architecture v1.0

**Status:** proposed, documentation only

**Date:** 2026-11-11

**Depends on:** `CC-FULL-SYSTEM-FORENSIC-AUDIT-2026-11-11.md`
**Implementation authorization:** not granted

## 1. Target outcome

Parallax OS must behave as one secure operating surface:

- one human sign-in;
- explicit internal authorization;
- durable conversations that survive reload, closure, interruption, and device changes;
- traceable agent routing and execution;
- project state derived from authoritative sources;
- honest freshness and degraded modes;
- mobile-first navigation and recovery;
- one audit trail connecting user intent, agent action, source evidence, and displayed state.

The system must never imply that data is live, saved, delivered, authorized, or complete without evidence for that exact claim.

## 2. System boundaries

### Command Center owns

- browser and mobile web experience;
- human identity session and application authorization;
- chat conversation, message, turn, and delivery records;
- UI read models and saved user state;
- project aggregation read model;
- command/event receipts and user-visible execution status;
- Command Center observability and audit evidence.

### RAMICHE OS owns

- canonical agent identities, roles, policies, decisions, context revisions, and evidence contracts;
- fleet topology and context convergence across OpenClaw and development surfaces;
- canonical project and work-journal publication contracts where already defined.

### OpenClaw owns

- agent sessions, tool execution, agent runtime state, and execution receipts;
- gateway transport and fleet-local capabilities.

### Source products own

- repository commits and PR state;
- deployment state;
- product-specific databases and metrics;
- external provider truth.

**Boundary rule:** Command Center consumes versioned RAMICHE OS and source-product contracts. It does not copy the private business brain into this repository and does not become a competing canonical memory store.

## 3. Target topology

```text
Human browser or installed PWA
  -> Cloudflare Access
  -> Next.js Command Center BFF
       -> Access assertion verifier
       -> app session and authorization
       -> Chat API + event stream
       -> Projects API + freshness read model
       -> Command API + approval gates
       -> audit/trace pipeline

Command Center BFF
  -> Supabase private schema via operation-scoped database functions and a least-privilege runtime role
  -> OpenClaw gateway via machine identity
  -> RAMICHE OS context publisher via versioned contract
  -> GitHub, deploy, journal, and product adapters

Reconcilers
  -> ingest events when available
  -> poll authoritative sources as repair
  -> build normalized current-state projections
  -> mark stale/unknown instead of preserving false certainty
```

The browser never receives a database credential and never directly reads private operational tables. The Supabase `service_role` is reserved for controlled migration, administration, and narrowly reviewed background maintenance. Normal requests use an operation-scoped runtime role or `SECURITY DEFINER` functions whose owner, search path, grants, tenant checks, membership checks, and audit behavior are explicit and tested.

## 4. Identity and single sign-on

### 4.1 Chosen strategy

Cloudflare Access remains the perimeter identity provider. The application validates the Access identity JWT and exchanges it for a short-lived Command Center session. A shared PIN is removed from the normal sign-in path.

This is identity reuse, not an authorization bypass.

### 4.2 Request sequence

1. User requests `command.parallaxvinc.com`.
2. Cloudflare Access authenticates according to the existing policy.
3. Cloudflare forwards the request with `Cf-Access-Jwt-Assertion`.
4. The BFF verifies:
   - JWT signature against the configured Access JWKS;
   - issuer and team domain;
   - exact application audience;
   - `exp`, `nbf`, and clock tolerance;
   - required subject and email claims;
   - email verification or IdP assurance claim when available;
   - explicit deny for service-token identities on human routes.
5. The BFF maps stable Access subject plus issuer to `app_principal`.
6. The BFF checks principal status and roles from the internal authorization store.
7. The BFF issues a signed or encrypted, opaque, HttpOnly, Secure, SameSite=Lax app session cookie.
8. Every Command Center page and API validates the app session. High-risk actions also validate a recent step-up grant.

This sequence is not acceptable until the origin is proven unreachable except through the intended Cloudflare path. Stage 0 must document the tunnel or origin binding, prevent direct-origin access, strip any caller-supplied identity headers at the trusted proxy boundary, and prove that a direct request or spoofed header is denied. Silent session re-exchange repeats assertion signature, issuer, audience, expiry, identity-type, and principal checks. The backend trusts the verified JWT only, never an email header by itself.

### 4.3 Principal model

```ts
type AppPrincipal = {
  id: string;                 // internal immutable UUID
  externalIssuer: string;     // Cloudflare Access issuer
  externalSubject: string;    // stable Access sub, never email alone
  email: string;
  status: "active" | "disabled";
  roles: AppRole[];
  sessionVersion: number;     // bump to revoke all sessions
  createdAt: string;
  updatedAt: string;
};

type AppRole =
  | "founder"
  | "operator"
  | "reviewer"
  | "read_only";
```

Authorization uses internal principal and role records. Email is an attribute, not the primary key.

### 4.4 Step-up authorization

The old PIN may be retired or repurposed only as one factor in a step-up flow. Step-up is required for:

- sending public content or outreach;
- spending or committing capital;
- changing auth, permissions, or credentials;
- destructive operations;
- production deploy or merge actions when surfaced in Command Center;
- reading or exporting specially classified financial or identity data.

Step-up grants are server-issued, action-scoped, short-lived, and single-use where practical. A Boolean in browser storage is not sufficient.

### 4.5 CSRF and session controls

- Require same-origin `Origin` for mutations.
- Use CSRF tokens for state-changing requests where cookie authentication is used.
- Rotate the app session after sign-in and step-up.
- Store only a session identifier in the cookie; keep revocable state server-side.
- Bind audit events to principal ID, session ID, Access subject hash, request ID, and action.
- Support immediate principal disable and session-version revocation.
- Separate human sessions from Cloudflare service tokens and OpenClaw machine credentials.

### 4.6 Auth state machine

```text
outside_access
  -> access_authenticated
  -> assertion_validating
  -> principal_authorized
  -> app_session_active

assertion_invalid -> access_error_with_recovery
principal_unknown -> access_denied_contact_admin
principal_disabled -> access_denied
session_expired -> silent_reexchange_if_access_valid -> active
high_risk_action -> step_up_required -> approved_or_cancelled
```

No state may render the cockpit before authorization is known.

### 4.7 Rollout and rollback

Use an explicit mode flag:

```text
CC_AUTH_MODE=legacy_pin
CC_AUTH_MODE=access_sso_shadow
CC_AUTH_MODE=access_sso_enforced
```

- **Shadow:** validate Access and log claim mapping without changing the user flow.
- **Enforced canary:** SSO for the founder principal; legacy PIN remains an emergency fallback behind a separate break-glass route.
- **Enforced:** remove the second login from normal navigation.
- **Rollback:** return to legacy mode without changing the Cloudflare Access application.

Break-glass access must be time-bounded, audited, disabled by default, and never bypass Cloudflare Access.

### 4.8 Threat model

| Asset or boundary | Attack path | Required control | Proof before enforcement | Residual risk or rollback trigger |
|---|---|---|---|---|
| Origin boundary | Direct-origin request bypasses Access | Origin lock, tunnel binding, firewall or platform protection, trusted-proxy header stripping | Direct-origin and spoofed-header negative tests | Any bypass keeps SSO in shadow or rolls back to legacy mode |
| Access assertion | Forged token, wrong issuer or audience, expired token, replay, service-token confusion | Verify signature, exact issuer and audience, time claims, identity type, stable subject; short exchange window | Invalid-token matrix and replay test | Unknown claim semantics block enforcement |
| App session | Cookie theft, fixation, login CSRF, stale privilege | HttpOnly Secure cookie, rotation, CSRF, session version, server revocation, short idle and absolute lifetime | Fixation, CSRF, revoke, disable, role-change tests | Unexpected authorization success triggers session kill and rollback |
| Browser content | XSS steals data or invokes actions | Strict CSP, output encoding, no secrets in browser storage, CSRF, step-up | CSP and stored/reflected XSS tests | Uncontained XSS blocks rollout |
| Tenant and conversation boundary | Cross-tenant or non-member read/write | Tenant-scoped runtime contract, membership check inside database operation, deny-by-default grants | Allow and deny database tests | Any isolation failure is a release blocker |
| Runtime database access | Broad service credential bypasses RLS | Least-privilege runtime role or reviewed functions; service role excluded from request path | Role and grant inspection, forbidden-operation tests | Broad credential in request process blocks rollout |
| OpenClaw boundary | SSRF, prompt/tool injection, forged machine response | Destination allowlist, machine identity, signed or mutually authenticated channel, tool allowlist, untrusted-content labeling, output validation | SSRF, prompt-injection, tool-authorization tests | Unbounded tool execution disables the adapter |
| Source ingestion | Forged webhook, replay, stale event, audit tampering | Signature check, timestamp window, event ID dedupe, monotonic revision rules, append-only audit sink | Forgery, replay, reordering, tamper tests | Conflict or unverifiable event becomes unavailable, never current |
| Attachments | Malware, oversize payload, unsafe content type, private URL leak | Size and type allowlist, isolated scan, quarantine, signed short-lived download, content-disposition controls | Malware fixture, polyglot, authorization, expiry tests | Scan outage keeps attachment quarantined |
| Capacity and cost | Request flood, expensive agent fan-out, SSE exhaustion, oversized history query, webhook flood | Per-principal and per-action limits, bounded pagination and fan-out, queue backpressure, timeouts, circuit breakers, concurrency caps | Load, abuse, slow-client, queue-saturation, and recovery tests | Saturation sheds noncritical work and blocks expansion; it never bypasses approval or silently drops accepted work |
| Break glass | Shared secret abuse or persistent bypass | Disabled by default, named principal, step-up, short expiry, alert, after-action review | Drill with issuance and revocation receipts | Unattributed use forces disable and incident review |

Threat review owners must record accepted residual risk. A rollback restores the prior authentication mode, revokes new sessions, disables new adapters, and preserves audit evidence. It never weakens Cloudflare Access.

## 5. Chat architecture

### 5.1 Design rules

1. The server acknowledges a message only after durable storage.
2. Every user send carries an idempotency key.
3. Every agent turn has a durable state machine.
4. Streams are resumable; the stream is not the record.
5. Client optimistic state is disposable and reconciles against server sequence numbers.
6. A reload never depends on the same process, tab, WebSocket, or device.
7. History, routing, execution, and presentation are separate concerns.

### 5.2 Core logical data model

The following is a logical contract, not an approved migration. A separate physical-schema review must define every foreign key, tenant column, role and session table, check constraint, index, retention policy, database owner, runtime grant, and migration rollback before database work is authorized.

```sql
app_principals(
  id uuid primary key,
  external_issuer text not null,
  external_subject text not null,
  email text not null,
  status text not null,
  session_version integer not null,
  unique(external_issuer, external_subject)
)

conversations(
  id uuid primary key,
  tenant_id uuid not null,
  kind text not null,                  -- channel, dm, project, incident
  channel_key text,
  title text,
  created_by uuid not null,
  last_message_seq bigint not null default 0,
  last_message_at timestamptz,
  archived_at timestamptz,
  version bigint not null default 1
)

conversation_members(
  conversation_id uuid not null,
  principal_type text not null,        -- user, agent, role
  principal_id text not null,
  permission text not null,            -- read, write, administer
  joined_at timestamptz not null,
  left_at timestamptz,
  primary key(conversation_id, principal_type, principal_id)
)

messages(
  id uuid primary key,
  conversation_id uuid not null,
  seq bigint not null,
  author_type text not null,
  author_id text not null,
  client_message_id uuid,
  reply_to_message_id uuid,
  turn_id uuid,
  content_markdown text not null,
  attachments jsonb not null default '[]',
  status text not null,                -- accepted, processing, complete, failed, cancelled
  created_at timestamptz not null,
  edited_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}',
  unique(conversation_id, seq),
  unique(author_type, author_id, client_message_id)
)

agent_turns(
  id uuid primary key,
  conversation_id uuid not null,
  request_message_id uuid not null,
  state text not null,
  routing_plan jsonb not null,
  context_revision text,
  attempt integer not null default 1,
  correlation_id uuid not null,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_detail_safe text
)

message_events(
  id uuid primary key,
  conversation_id uuid not null,
  message_id uuid,
  turn_id uuid,
  event_type text not null,
  event_seq bigint not null,
  payload jsonb not null,
  created_at timestamptz not null,
  unique(conversation_id, event_seq)
)

conversation_user_state(
  principal_id uuid not null,
  conversation_id uuid not null,
  last_read_seq bigint not null default 0,
  last_opened_at timestamptz,
  draft_ciphertext text,
  draft_updated_at timestamptz,
  scroll_anchor_message_id uuid,
  primary key(principal_id, conversation_id)
)
```

Existing channel/message IDs should be preserved or mapped through a migration table. No destructive rewrite is required for the first cut.

Physical-schema invariants:

- Every tenant-owned row carries `tenant_id`, or reaches it through a non-optional foreign key whose authorization function locks and checks the parent.
- A user-message insert, conversation sequence allocation, turn creation, and first durable event commit in one database transaction.
- Sequence allocation locks the conversation row and increments `last_message_seq`; event allocation uses the same rule for a conversation event watermark. No client assigns either value.
- The user-message idempotency rule is a partial unique constraint on tenant, authenticated principal, and non-null client message ID. The HTTP idempotency record stores request hash and original response so a reused key with a different body is rejected.
- Message, turn, and event status values use check constraints. Foreign keys define deletion behavior explicitly.
- Runtime functions accept the authenticated principal and tenant from verified server context, never from an unchecked request body.
- Required indexes cover conversation plus sequence, tenant plus updated time, principal membership, idempotency lookup, turn state, and event replay.

### 5.2.1 Sensitive-data lifecycle

Before migration approval, the data classification register must assign retention and deletion behavior to chat text, drafts, attachments, audit events, routing traces, source receipts, exports, and backups.

- A user delete creates an authorization-checked tombstone and removes content according to the approved retention class. It does not silently rewrite audit history.
- Draft encryption keys are server-owned, versioned, rotated, and separate from database credentials. Draft plaintext is not logged.
- Attachments remain quarantined until type, size, and malware checks pass. Downloads are membership-checked and use short-lived signed access.
- Export, backup, restore, legal-hold, and account-disable behavior must be tested before cross-device history is enabled.
- Audit retention is longer than ordinary debug telemetry, append-only, and access-restricted. Exact periods remain a founder and legal decision, not an engineering guess.

### 5.3 API contracts

#### List conversations

`GET /api/cc/v1/conversations?cursor=<opaque>&limit=30`

Response:

```json
{
  "items": [{
    "id": "uuid",
    "kind": "channel",
    "title": "Content Team",
    "lastMessageSeq": 165,
    "lastMessageAt": "ISO-8601",
    "unreadCount": 0,
    "sync": { "state": "current", "asOf": "ISO-8601" }
  }],
  "nextCursor": "opaque-or-null"
}
```

#### Rehydrate messages

`GET /api/cc/v1/conversations/{id}/messages?before_seq=<n>&limit=50`

- Authorize membership server-side.
- Return stable chronological sequence numbers.
- Include `hasMoreBefore` and `serverHighWatermark`.
- Never return an empty array for an internal failure. Return a typed non-2xx error.

#### Send message

`POST /api/cc/v1/conversations/{id}/messages`

Headers:

- `Idempotency-Key: <uuid>`
- CSRF token

Body:

```json
{
  "clientMessageId": "uuid",
  "content": "text",
  "replyToMessageId": null,
  "attachments": [],
  "requestedAgents": ["atlas"]
}
```

Response after durable acceptance:

```json
{
  "message": { "id": "uuid", "seq": 166, "status": "accepted" },
  "turn": { "id": "uuid", "state": "queued" },
  "streamCursor": 9012
}
```

Repeated sends with the same principal and idempotency key return the original accepted record.

The database transaction commits the user message, allocated sequence, idempotency record, logical turn, and queued event together. Worker dispatch happens only after that commit through a durable outbox. A dispatch failure leaves a visible queued or retry state, not an acknowledged but untracked turn.

#### Resume events

`GET /api/cc/v1/events?conversation_id=<id>&after=<event_seq>`

Use SSE initially. Send heartbeat comments. Support `Last-Event-ID`. Reconnection replays events after the last durable event sequence. If the replay window is exceeded, return `reset_required` and rehydrate through REST.

### 5.4 Turn state machine

```text
accepted -> queued -> routing -> executing
executing -> synthesizing -> verifying -> persisting -> complete

queued|routing|executing|synthesizing|verifying -> retry_wait -> executing
any nonterminal -> failed_retryable
any nonterminal -> failed_terminal
any cancellable -> cancel_requested -> cancelled
```

Every transition writes one `message_event` with actor, attempt, cause, and timestamp. The UI renders the state it received; it does not infer “typing” from a timer.

### 5.5 Agent routing contract

```ts
type RoutingPlan = {
  registryRevision: string;
  contextRevision: string | null;
  requestedAgents: string[];
  resolvedAgents: Array<{
    agentId: string;
    sessionKey: string;
    reason: string;
    required: boolean;
  }>;
  synthesisAgent: string | null;
  verifierAgent: string | null;
  executionMode: "single" | "parallel" | "sequential";
};
```

- Resolve against the canonical agent registry revision.
- Persist the plan before execution.
- Do not silently route all agents to one `main` session unless that is the recorded plan.
- Treat missing sessions, timeouts, `[NO_RESPONSE]`, and provider fallbacks as separate outcomes.
- Preserve provider, model, latency, attempt, and source receipt without exposing secrets.

### 5.6 Context continuity

Context assembly is deterministic and recorded:

1. conversation window by sequence;
2. thread/reply chain;
3. pinned decisions and approved artifacts;
4. RAMICHE OS context bundle by revision;
5. project/source evidence by revision;
6. token-budget trimming with an audit summary of omissions.

The resulting `context_revision` and component revisions are stored on the turn. The Command Center must not claim an agent “remembered” a fact unless the trace shows it was retrieved or present in the selected window.

### 5.7 Client rehydration and cross-device behavior

On boot:

1. validate app session;
2. load server-side user state;
3. restore last conversation if still authorized;
4. fetch newest page and high-watermark;
5. restore draft and scroll anchor;
6. subscribe after the high-watermark;
7. merge by message ID and sequence;
8. render current, stale, reconnecting, or unavailable state explicitly.

On foreground resume:

1. check session;
2. compare last durable event cursor;
3. replay missed events;
4. rehydrate if the cursor is too old;
5. preserve unsent local draft until server draft acknowledgement.

### 5.8 Retry and idempotency rules

- A network retry never creates another user message.
- A provider retry increments the same `agent_turn.attempt` unless the user explicitly starts a new turn.
- Attachment upload uses content hash plus upload intent ID.
- An interrupted stream never changes execution state by itself.
- `complete` is emitted only after the final message and all required receipts are durable.
- Partial multi-agent completion is a first-class state with per-agent outcomes.

### 5.9 Durable send sequence

```text
client -> BFF: send with client message ID and idempotency key
BFF -> database operation: authorize member and begin transaction
database operation: lock conversation, allocate sequence, write message + turn + outbox + event
database operation -> BFF: commit and return accepted record
BFF -> client: accepted record and event cursor
dispatcher -> outbox: claim queued turn
worker -> routing/execution/verification: persist each state transition
worker -> database operation: commit final message and complete event
event delivery -> clients: replay from durable cursor
```

If the initial transaction fails, the BFF returns a typed failure and no accepted state. If dispatch or execution fails after acceptance, the same turn advances to a retry or failure state. It never creates a second user message.

## 6. Project intelligence architecture

### 6.1 Source registry

Every project declares authoritative fields and adapters:

```ts
type ProjectSource = {
  projectId: string;
  sourceId: string;
  kind: "github" | "journal" | "ramiche_context" | "openclaw" | "vercel" | "supabase" | "manual";
  authority: "canonical" | "supporting" | "evidence_only";
  fields: string[];
  adapterVersion: string;
  freshnessBudgetSeconds: number;
  reconcileIntervalSeconds: number;
  enabled: boolean;
};
```

No field may have two canonical writers.

Stage 4 is not implementation-ready until the running RAMICHE OS publication contract is inspected and an approved registry names the actual adapter, field owner, conflict owner, and freshness budget for every displayed field in every active project. The generic model below is the contract shape, not evidence that those mappings already exist.

Required registry columns are: project ID, field path, canonical source, source locator, adapter owner, conflict owner, observation method, revision field, freshness budget, repair interval, failure behavior, and approved fallback. The registry itself is versioned and reviewable.

### 6.2 Normalized project model

```ts
type ProjectSnapshot = {
  projectId: string;
  name: string;
  lifecycle: "proposed" | "planning" | "active" | "blocked" | "shipped" | "paused" | "retired";
  summary: string;
  ownerIds: string[];
  priority: number | null;
  blockers: Blocker[];
  milestones: Milestone[];
  linkedRepos: RepoRef[];
  activeExecutions: ExecutionRef[];
  deployment: DeploymentSummary | null;
  decisions: DecisionRef[];
  sources: SourceReceipt[];
  confidence: "verified" | "partial" | "conflicted" | "unknown";
  observedAt: string;
  computedAt: string;
  version: number;
};
```

### 6.3 Event plus reconciliation model

- Prefer webhooks or durable events from GitHub, deployments, OpenClaw, and RAMICHE OS publishers.
- Treat events as hints, not proof that the projection is complete.
- Run bounded polling reconciliation to repair missed events.
- Each adapter writes a `source_receipt` containing source revision, observed time, ingest time, checksum, and result.
- Projection builds are idempotent and versioned.
- Conflicting canonical claims set `confidence=conflicted`; they do not choose a winner silently.

Ingestion sequence:

```text
source -> ingest endpoint: signed event with source event ID and revision
ingest endpoint: authenticate, reject replay, persist raw receipt
reconciler: read authoritative source at or beyond claimed revision
adapter: normalize fields and persist source receipt
projector: compare field authority, build next immutable projection version
projector -> event log: publish changed version and freshness state
client: apply only a newer projection version
scheduled poll: repeat authoritative read and repair missed or reordered events
```

A webhook never writes the displayed projection directly. A failed reconciliation retains the last known value with stale or unavailable state.

### 6.4 Freshness model

```ts
type SourceReceipt = {
  sourceId: string;
  sourceRevision: string | null;
  sourceObservedAt: string | null;
  ingestedAt: string;
  lastSuccessAt: string | null;
  lastAttemptAt: string;
  status: "current" | "aging" | "stale" | "unavailable" | "invalid";
  errorCode: string | null;
};
```

Freshness is computed from authoritative source observation, not page fetch time.

UI contract:

- **Current:** within source-specific budget.
- **Aging:** approaching the budget; show as-of time.
- **Stale:** budget exceeded; retain last known value with warning.
- **Unavailable:** no successful read; do not show old data as current.
- **Conflicted:** sources disagree; display both claims and decision owner.
- **Unknown:** no source contract exists; prohibit LIVE label.

### 6.5 Project API

`GET /api/cc/v1/projects?cursor=&lifecycle=&confidence=`

Each item returns `asOf`, `confidence`, and per-source receipts. The response includes a server-generated `projectionVersion`; client polling or events compare versions rather than blindly replacing state.

### 6.6 Static file retirement

`shared-projects.ts` and `public/projects/*` become one-time seed and historical documentation only. They must not remain runtime truth after the new projection is accepted. Preserve history; stop calling it live.

## 7. Mobile-first experience contract

### 7.1 Navigation

Phone primary navigation has four top-level destinations:

1. Today
2. Chat
3. Projects
4. More

Chat is a two-step flow on phone:

```text
conversation list -> conversation -> optional details/thread
```

No three-column layout is squeezed into one viewport. Back navigation restores list scroll and filters.

### 7.2 Viewport and safe areas

- Use dynamic viewport units with fallback, not `100vh` alone.
- Respect `env(safe-area-inset-top/right/bottom/left)`.
- The composer remains visible above the software keyboard.
- Avoid multiple fixed layers competing for the same top and bottom space.
- Minimum interactive target is 44 by 44 CSS pixels.
- No core action depends on hover.

### 7.3 Mobile chat

- Draft is saved after idle and on visibility change.
- Foreground resume reconciles events before showing “current.”
- Attachment upload shows queued, uploading, durable, and failed states.
- Send remains available on unstable networks through an explicit outbox, never a fake sent checkmark.
- Conversation header shows connection and history state in plain language.
- Scroll position is anchored by message ID, not pixel offset.
- Long agent output uses readable progressive disclosure without hiding the full response.

### 7.4 Mobile projects

- Lead with lifecycle, blocker count, and source freshness.
- Do not render uniform card grids as the information architecture.
- Use a decision-first list ordered by action required.
- Each project exposes “why this status” with source receipts.
- Manual refresh means “reconcile sources,” not “stamp now as last sync.”

### 7.5 Offline and degraded mode

- Cached data is labeled with its `asOf` time.
- Writes queue only when idempotent and safe.
- Gated actions cannot queue silently while offline.
- When history is unavailable, show the error and retry path. Do not substitute demo messages.

## 8. Permissions

| Capability | Founder | Operator | Reviewer | Read only |
|---|---:|---:|---:|---:|
| Read authorized conversations/projects | Yes | Yes | Yes | Yes |
| Send internal chat | Yes | Yes | Pending policy | No |
| Approve agent plan | Yes | Scoped | Review only | No |
| Send public content/outreach | Step-up | Step-up + scoped approval | No | No |
| Spend or change pricing | Step-up | No unless explicitly delegated | No | No |
| Change auth/roles | Step-up | No | No | No |
| Merge/deploy | Separate founder gate | Scoped and gated | No | No |
| Export sensitive data | Step-up | Scoped | No | No |

`Scoped` means an explicit capability ID plus resource selector stored in the internal authorization policy, such as `project.read:project_id` or `conversation.send:conversation_id`. No wildcard is implied. Reviewer send semantics remain pending founder approval and must not be implemented as “comment only” without a modeled comment resource. Every denial returns a stable error code and safe explanation. Hidden buttons are not authorization.

## 9. Observability

### 9.1 Correlation

Every user action receives:

- `request_id` for HTTP;
- `correlation_id` for the end-to-end intent;
- `turn_id` for agent work;
- `source_receipt_id` for project ingestion;
- `session_id` and `principal_id` for authorization audit.

These identifiers propagate through BFF, Supabase, OpenClaw, provider adapters, and UI events.

### 9.2 Metrics

Auth:

- Access assertion validation success/failure by reason;
- session exchange latency;
- session expiry and forced reauthentication rate;
- authorization denials by capability.

Chat:

- accepted-to-first-event, accepted-to-first-token, and accepted-to-durable-complete;
- persistence failure rate;
- resume success rate;
- duplicate prevented count;
- rehydration failures;
- partial multi-agent completion;
- stale stream cursor resets.

Projects:

- source ingestion latency;
- reconciliation lag;
- stale project count;
- source conflict count;
- projection build failures;
- UI views of stale or unavailable state.

Mobile:

- foreground resume duration;
- draft recovery success;
- send recovery after network change;
- layout shift and interaction latency by device class.

### 9.3 Logs and privacy

- Structured logs only.
- No raw Access JWTs, service tokens, chat content, credentials, or attachment URLs in default logs.
- Safe error codes and redacted provider diagnostics.
- Sample content only through explicit, time-bounded debug mode with founder approval.
- Audit records are append-only and retention-controlled.

## 10. Proposed SLOs and error budgets

These are **targets for approval**, not measured current performance.

| User journey | Proposed SLO | Measurement |
|---|---|---|
| Authorized user reaches Command Center without a second credential prompt | 99.9% monthly | Access success to app-session success |
| Accepted user message is durably visible after reload | 99.99% monthly | Synthetic send, close, rehydrate |
| Duplicate durable message for one accepted idempotency key | 0 | Database invariant and synthetic retry test |
| Idempotency replay and body-conflict handling observed | 99.99% classified correctly | Idempotency telemetry |
| Chat history initial page | p95 <= 1.5s on normal mobile network | Navigation start to durable history render |
| Event resume after foreground | p95 <= 2s | Visibility resume to caught-up watermark |
| Project projection freshness | 99% within each source budget | `sourceObservedAt` against budget |
| False LIVE label | 0 | UI and contract tests |
| Gated action without valid authorization receipt | 0 | Audit invariant |

Error-budget exhaustion pauses feature work for the affected journey until reliability returns.

## 11. Testing strategy

### 11.1 Contract tests

- Access JWT valid, expired, wrong issuer, wrong audience, missing claim, service-token identity.
- Principal active, unknown, disabled, role changed, session version revoked.
- Chat pagination, sequence monotonicity, membership isolation, idempotent send, event replay, reset-required.
- Project field authority, freshness transitions, conflict handling, adapter versioning.

### 11.2 Database tests

- Browser/public role cannot read or write private chat and project data.
- Runtime role or operation-scoped function can perform only intended server operations; service role is absent from the request path.
- Tenant and conversation membership isolation.
- Unique idempotency and sequence constraints.
- RLS and grants tested for allow and deny cases.

### 11.3 Failure injection

- Supabase unavailable after user presses send.
- Agent provider timeout after durable acceptance.
- one of several agents fails while others complete;
- SSE disconnect during synthesis;
- app killed after send but before response;
- network changes Wi-Fi to cellular;
- source webhook lost, reconciliation repairs state;
- project source returns an older revision;
- Cloudflare assertion expires during an active session;
- OpenClaw gateway unavailable;
- client clock is wrong.

Additional sequence tests:

- app session expires during SSE; the client re-exchanges only after a fresh valid Access assertion, resumes from the same event cursor, and never duplicates work;
- two devices update last-opened conversation and draft; the server applies version checks, preserves the newer durable draft, and returns a conflict instead of silent overwrite;
- project webhook is lost or replayed; polling repairs the first case and dedupe rejects the second;
- auth rollback revokes new app sessions, restores legacy mode behind Access, and retains audit receipts;
- chat worker rollback stops new dispatch, leaves accepted turns visible, and allows controlled retry after restoration.

### 11.4 Mobile acceptance matrix

Required before release:

- real iPhone Safari, current supported iOS;
- installed PWA if that remains a supported surface;
- Android Chrome on a real device;
- 390px and 1920px Playwright regression for deterministic layout;
- VoiceOver and keyboard coverage for core flows;
- reduced-motion coverage;
- slow network, offline, background for five minutes, and force-close/reopen.

Chromium emulation is supporting evidence only. It does not certify Safari or real-device lifecycle behavior.

### 11.5 Acceptance journeys

1. Sign in once through Access, open cockpit without PIN.
2. Send Content Team message, observe durable accepted state, close app, reopen, recover same conversation and response.
3. Start on phone, continue the same conversation on desktop, return to phone, reconcile without duplicate or lost draft.
4. Retry after a network interruption and prove one message exists.
5. Open Projects and identify source, revision, as-of time, and stale state for every displayed claim.
6. Block a project source and prove the UI shows stale or unavailable rather than LIVE.
7. Attempt a gated action without step-up and prove server denial and audit receipt.

## 12. Delivery sequence

### Stage 0: freeze and evidence

- Record deployed origin, immutable SHA, Access application audience, claim shape, and active environment topology.
- Capture the current mobile incident in a reproducible test.
- Mark contradictory documents historical.
- Run mobile lifecycle evidence at 390px and, where authentication is available, on real iPhone Safari or the installed PWA. Cover initial load, Access return, channel selection, reload, close/reopen, background/foreground, offline/reconnect, and typed failure state. Do not send or change production data merely to prove rehydration.

**Gate:** evidence package reviewed, origin lock proven, direct-origin negative test passed, claim contract recorded, and mobile lifecycle defect captured without production mutation. No implementation before this gate except the approved Stage 0 evidence work itself.

### Stage 1: identity foundation

- Implement Access assertion verifier and principal mapping behind shadow mode.
- Implement app session, authorization middleware, CSRF, audit receipts, and break-glass.
- Introduce the least-privilege database runtime contract. Keep `service_role` out of request handling.
- Keep the legacy PIN until SSO canary passes.
- Prove mobile Access return, background/foreground, reload, browser restart, and session-expiry recovery at 390px plus a real-phone canary. The phone must never enter a blank authenticated shell or a redirect loop.

**Gate:** security review, invalid-token suite, mobile lifecycle canary, rollback drill.

### Stage 2: private chat BFF and rehydration

- Add server conversation and message reads.
- Persist last conversation, draft, and cursor.
- Remove direct browser reads/writes to private tables.
- Add typed unavailable state.
- Prove Content Team selection, reload, close/reopen, background/foreground, offline/reconnect, and second-device continuation on mobile without duplicate or missing rows.

**Gate:** reported Content Team conversation rehydrates on real phone and second device.

### Stage 3: durable turn engine

- Add idempotency, turn state, event log, resumable stream, partial completion, and cancellation.
- Split routing, execution, synthesis, verification, and persistence modules.
- Prove mobile interruption, resume cursor, cancellation, partial completion, retry, and duplicate suppression across background/foreground and network loss.

**Gate:** failure-injection suite, mobile lifecycle acceptance, and no duplicate sends.

### Stage 4: project source registry and projection

- Inspect the existing RAMICHE OS publisher and approve the concrete field-level registry before adapter implementation.
- Register authoritative sources per project.
- Build adapters, receipts, reconciler, projection, conflicts, and freshness.
- Retire static runtime truth.
- Prove on mobile that stale, unavailable, conflict, and source-as-of states survive reload, background/foreground, and reconnect without reverting to LIVE.

**Gate:** every project field has an owner and freshness status; false LIVE contract test and mobile lifecycle acceptance pass.

### Stage 5: mobile-first shell

- Implement phone navigation, safe-area and dynamic viewport contract, lifecycle recovery, outbox, and responsive information hierarchy.
- Re-run all earlier identity, chat, turn-engine, and Projects lifecycle cases on the integrated shell. Stage 5 is consolidation, not the first mobile acceptance point.

**Gate:** real-device acceptance plus 390px and 1920px regression.

### Stage 6: controlled rollout

- internal canary;
- SSO shadow to enforced;
- chat BFF reads before writes;
- project projection in compare mode against legacy;
- measured expansion;
- remove legacy paths only after rollback window.
- require the mobile lifecycle suite at every canary expansion and after rollback rehearsal.

No stage authorizes a production deploy, database migration, Cloudflare change, or merge without separate founder approval.

## 13. Definition of done

The system is implementation-complete only when:

- identity is validated once and authorization remains explicit;
- all private data paths are server-owned;
- a persisted message survives every supported lifecycle transition;
- a retry cannot create duplicates;
- every agent turn has a durable state and trace;
- every project claim has authority, revision, time, and confidence;
- stale and failure states are visible;
- mobile is accepted on real devices;
- security, recovery, and rollback have been exercised;
- a clean-context reviewer that did not build the surface grades it against this specification and the preservation ledger;
- Ramon separately approves merge and deployment.
