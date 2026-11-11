# Parallax OS Command Center decision register v1.0

**Status:** proposed decisions awaiting founder approval

**Date:** 2026-11-11
**Rule:** A proposed decision is not implementation authorization.

## Decision status vocabulary

- **Proposed:** recommended by this audit, not approved.
- **Accepted:** founder approved for implementation.
- **Rejected:** considered and not selected.
- **Superseded:** replaced by a later decision.
- **Blocked:** cannot decide without named evidence.

## Register

### CC-ADR-001: Cloudflare Access is the human identity boundary

- **Status:** Proposed
- **Decision:** Preserve Cloudflare Access and validate its identity JWT in the Command Center backend.
- **Reason:** Removes redundant login while retaining the existing perimeter and explicit application authorization.
- **Rejected alternative:** Remove Cloudflare Access and rely on a portal PIN.
- **Rejected alternative:** Trust headers without JWT verification.
- **Evidence required before acceptance:** application audience, issuer, JWKS, policy export, forwarded claim sample.
- **Rollback:** legacy PIN mode behind Access.

### CC-ADR-002: Shared PIN leaves the normal sign-in path

- **Status:** Proposed
- **Decision:** Remove the client-held shared PIN from normal login after SSO canary acceptance. Retain only a server-issued step-up or break-glass mechanism if needed.
- **Reason:** The current PIN adds friction but does not establish a server principal.
- **Risk:** Removing it before Access-to-principal mapping is proven could reduce defense in depth.
- **Gate:** SSO canary, invalid-assertion tests, and rollback drill.

### CC-ADR-003: Private operational data is BFF-only

- **Status:** Proposed
- **Decision:** Browser clients must not directly read or write private Supabase chat, project, agent, tenant, or execution tables.
- **Reason:** Production already removed public grants. The current client path conflicts with that security decision.
- **Rejected alternative:** Restore anonymous policies so Realtime works directly.
- **Reason rejected:** Cloudflare protects the app hostname, not direct Supabase endpoints. Public database grants would reopen private cockpit data outside the Access boundary.

### CC-ADR-004: One durable conversation model

- **Status:** Proposed
- **Decision:** Introduce explicit conversations, membership, ordered messages, turns, events, and per-user state. Preserve existing IDs through mapping.
- **Reason:** Channels plus messages do not fully represent DMs, resume cursors, drafts, authorization, turn state, or cross-device continuity.
- **Migration constraint:** No destructive migration. Dual-read compare mode before cutover.

### CC-ADR-005: Every send is idempotent

- **Status:** Proposed
- **Decision:** Require a client message UUID and HTTP idempotency key for every user send.
- **Invariant:** One principal plus one idempotency key produces at most one durable user message and one logical turn.
- **Reason:** Mobile retries and reconnects are normal, not edge cases.

### CC-ADR-006: SSE is transport, database events are record

- **Status:** Proposed
- **Decision:** Use resumable SSE for browser event delivery backed by a durable event log and REST rehydration.
- **Reason:** A WebSocket or stream disconnect must not determine whether a turn exists or completed.
- **Future option:** WebSocket transport may be added without changing the event contract.

### CC-ADR-007: Agent routing is revisioned and auditable

- **Status:** Proposed
- **Decision:** Persist the resolved routing plan, registry revision, context revision, agents, session keys, execution mode, provider attempts, synthesis, and verifier.
- **Reason:** “Sent to the team” must be traceable to actual sessions and outcomes.
- **Boundary:** Command Center consumes the RAMICHE OS agent registry. It does not create a competing registry.

### CC-ADR-008: Project truth comes from a field-level source registry

- **Status:** Proposed
- **Decision:** Each project field names one canonical writer and optional supporting sources.
- **Reason:** A whole-project “single source” is too coarse. Repository status, deployment, blockers, decisions, and active execution are owned by different systems.
- **Rejected alternative:** Keep `shared-projects.ts` as the canonical catalog.
- **Reason rejected:** It was already months stale while the UI claimed LIVE.

### CC-ADR-009: Events plus reconciliation

- **Status:** Proposed
- **Decision:** Use source events for low latency and periodic authoritative polling for repair.
- **Reason:** Webhooks are fast but can be missed; polling is slower but repairs gaps. Neither alone is sufficient.

### CC-ADR-010: Freshness is a contract, not a badge

- **Status:** Proposed
- **Decision:** Every operational projection carries source revision, source observation time, ingest time, last success, and freshness state.
- **Invariant:** Browser fetch time cannot produce a LIVE claim.
- **UI states:** current, aging, stale, unavailable, invalid, conflicted, unknown.

### CC-ADR-011: Mobile is the primary flow for chat and operational triage

- **Status:** Proposed
- **Decision:** Design phone navigation and lifecycle first, then enhance desktop.
- **Reason:** The reported defects occurred on mobile and involve state restoration, not only layout.
- **Acceptance:** real iPhone Safari plus real Android Chrome; emulation is supporting evidence.

### CC-ADR-012: RAMICHE OS context convergence remains a separate system contract

- **Status:** Proposed
- **Decision:** Reference RAMICHE OS identity, policy, decision, and context bundles by revision. Do not merge its repository or private doctrine into Command Center state.
- **Reason:** Context convergence and Command Center product reliability are related but separate. Conflating them would create another source-of-truth conflict.

### CC-ADR-013: Step-up gates external and irreversible actions

- **Status:** Proposed
- **Decision:** Public sends, spend, credential and permission changes, destructive operations, merges, and deployments require a recent server-side step-up and the applicable founder approval.
- **Reason:** Friction belongs at risky action boundaries, not at every app open.

### CC-ADR-014: No silent fallback to demo or stale data

- **Status:** Proposed
- **Decision:** A failed internal read returns an explicit unavailable or stale state. Demo defaults are allowed only in a clearly labeled development mode.
- **Reason:** Empty, demo, and stale states currently conceal real failures.

### CC-ADR-015: Roll out by reversible compatibility stages

- **Status:** Proposed
- **Decision:** Use shadow validation, canaries, dual-read comparison, feature flags, and rollback drills. Remove legacy paths only after acceptance evidence.
- **Reason:** Identity and persistence changes are high-risk. A single cutover would combine too many failure modes.

### CC-ADR-016: Runtime database access is least privilege

- **Status:** Proposed
- **Decision:** Normal Command Center requests use a least-privilege runtime role or narrowly reviewed database functions. The Supabase `service_role` is excluded from the browser-facing request path and reserved for controlled administration, migration, and approved maintenance.
- **Reason:** A broad service identity bypasses RLS and can turn a missed application check into cross-tenant exposure.
- **Required proof:** operation-level grants, fixed function search paths, tenant and membership enforcement inside the database contract, forbidden-operation tests, and credential inventory.
- **Rollback:** disable the new runtime path and return to the prior server path behind Access. Do not restore browser grants.

### CC-ADR-017: Threat acceptance is an explicit release artifact

- **Status:** Proposed
- **Decision:** Identity, chat, project ingestion, attachments, OpenClaw integration, break glass, and audit boundaries require a named threat owner, test evidence, accepted residual risk, and rollback trigger before rollout.
- **Reason:** Scattered controls do not provide a reviewable security decision.
- **Gate:** the threat table in the architecture is reviewed alongside the origin topology and Access policy evidence.

## Blocked decisions

### CC-BDR-001: active production origin

- **Status:** Blocked
- **Question:** Does Cloudflare tunnel to the iMac/local Next process, Vercel, or another origin for the current Command Center?
- **Needed evidence:** Cloudflare tunnel route and immutable deployment SHA.
- **Why blocked:** Vercel team scope returned 403 and Cloudflare control-plane access was unavailable.

### CC-BDR-002: Access claim and session policy

- **Status:** Blocked
- **Question:** Which identity claim is stable, what is the exact audience, and what are the current Access session and bypass rules?
- **Needed evidence:** redacted authenticated claim sample and policy export.

### CC-BDR-003: existing RAMICHE OS project publication contract

- **Status:** Blocked
- **Question:** Which current context, journal, or project-state publisher should the Project reconciler consume?
- **Needed evidence:** owning repository contract and running bridge status.
- **Guardrail:** Do not rebuild an owned capability inside `ramiche-site`.

## Approval checklist

Founder approval should address these separately:

- [ ] Accept or amend CC-ADR-001 through CC-ADR-017.
- [ ] Authorize read-only Cloudflare policy and tunnel inspection.
- [ ] Authorize Vercel team read access if Vercel remains in the topology.
- [ ] Authorize Stage 1 identity implementation.
- [ ] Authorize Stage 2 chat BFF and schema design.
- [ ] Authorize any database migration separately after migration review and rollback proof.
- [ ] Authorize production deployment separately after real-device and security acceptance.
