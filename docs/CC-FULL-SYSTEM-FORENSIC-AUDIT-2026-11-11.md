# Parallax OS Command Center full-system forensic audit

**Date:** 2026-11-11

**Repository:** `ramicheAi/ramiche-site`

**Audited revision:** `main@25f1f51`

**Mode:** documentation and read-only verification only
**Verdict:** **NO-GO for further feature implementation until the P0 data and identity seams are resolved**

## 1. Executive finding

The Command Center is not one connected system today. It is a visually integrated shell over several state paths that disagree about identity, authorization, persistence, freshness, and source of truth.

The five reported problems are real. Two have direct, current root-cause evidence:

1. **Double authentication is implemented intentionally in two independent layers.** Cloudflare Access protects the hostname, then `src/app/command-center/layout.tsx` requires a second PIN stored only in browser `sessionStorage`.
2. **Projects can be months old while the UI says LIVE.** The route polls hardcoded metadata and repository files, while the displayed “Last synced” value is the browser fetch time rather than the source observation time.

The lost Content Team conversation was **not deleted**. The live database contains the user message and six agent responses from 2026-11-10. The current repository has two separate rehydration defects that can make persisted content appear gone:

- the browser still reads private chat tables with the public Supabase key even though production has applied the anonymous-access lockdown;
- the selected channel or DM is not durably restored, and the startup loader selects a default or the first returned channel rather than the user’s last conversation.

The exact contribution of each defect to the phone incident remains unproven because the deployed origin revision and Cloudflare policy configuration were not accessible in this audit. That uncertainty does not weaken the required fix: both seams are incorrect and both must be removed.

## 2. Scope and evidence rules

### Inspected

- repository source, migrations, tests, history, and existing Command Center documentation;
- Cloudflare’s unauthenticated public response for `command.parallaxvinc.com`;
- live Supabase migration history, table grants, RLS posture, Realtime publication membership, aggregate chat records, recent Content Team row metadata, security advisories, and a bounded log window;
- current test and typecheck results.

### Not changed

- application code;
- Cloudflare Access applications or policies;
- production or preview deployments;
- database schema or data;
- credentials, environment variables, or service tokens;
- OpenClaw configuration;
- GitHub default branches or merges.

### Evidence labels

- **Observed:** directly read from current source, live metadata, database, or HTTP response.
- **Derived:** necessarily follows from two or more observed facts.
- **Hypothesis:** plausible but requires runtime or configuration evidence not available here.
- **Unknown:** evidence was inaccessible or does not exist.

## 3. Evidence ledger

| ID | Status | Finding | Evidence |
|---|---|---|---|
| E-01 | Observed | Cloudflare Access is active on the Command Center hostname. | Unauthenticated `GET /command-center` returned HTTP 302 to the Cloudflare Access login domain on 2026-11-11. |
| E-02 | Observed | A second PIN gate is rendered after Cloudflare Access. | `src/app/command-center/layout.tsx` reads `cc-pin-auth` from `sessionStorage` and renders `PinGate` when absent. |
| E-03 | Observed | The PIN is not an application session. | Successful `/api/command-center/auth/pin` returns JSON only. The browser writes `{ok:true}` to `sessionStorage`; no signed, HttpOnly server session is created. |
| E-04 | Observed | Command Center APIs are host-gated, not user-authorized in middleware. | `src/middleware.ts` permits any request whose forwarded host starts with `command.`, localhost, loopback, or `.ts.net`. It does not validate an Access assertion or app role. |
| E-05 | Observed | The Content Team conversation exists. | Live Supabase has one user message and six agent responses between 23:26:54Z and 23:27:31Z on 2026-11-10. Content lengths were inspected, not content text. |
| E-06 | Observed | Chat private tables are locked to `service_role`. | Live migration history includes `20260928120000 p05b3_cockpit_anon_lockdown`; `messages`, `message_reactions`, `channels`, `channel_members`, `agent_profiles`, and `tenants` have RLS enabled, no policies, no `anon` or `authenticated` grants, and full `service_role` grants. |
| E-07 | Observed | The current browser chat still queries and inserts directly with the public key. | `src/app/command-center/chat/page.tsx` uses the client from `src/lib/supabase.ts` for channels, agents, messages, reactions, Realtime, polling, and the initial user-message insert. |
| E-08 | Observed | Initial message-load errors are discarded. | The main message query destructures `{ data }` but not `error`; an authorization failure produces no visible recovery state. The polling fallback also returns silently on `error`. |
| E-09 | Observed | Conversation selection is not durably restored. | `activeChannel`, `activeAgent`, and `viewMode` are component state. Only explicit hash deep links survive navigation. Startup selects `mapped[0]`, `merged[0]`, or a default. |
| E-10 | Observed | Server-side persistence is partially hardened. | `src/lib/chat-persistence.ts` and `src/app/api/command-center/chat/route.ts` fail visibly when all reply writes fail and use the service role for agent reply persistence. |
| E-11 | Observed | Chat orchestration and execution are mixed in one oversized route. | The POST route performs target resolution, history loading, provider selection, fan-out, synthesis, critic/refinement, OpenClaw execution, image handling, persistence, and response shaping. |
| E-12 | Observed | “Projects” does not consume live fleet state. | `/api/command-center/projects` merges `shared-projects.ts` with `public/projects/*/TASKS.md` and `META.json` from GitHub `main`, cached five minutes. It does not read the shared journal, OpenClaw sessions, linked repositories, deployments, or canonical context service. |
| E-13 | Observed | The project catalog is stale by construction. | `shared-projects.ts` says “Last updated: 2026-03-28.” Most task and metadata files were last committed in March; Command Center and METTLE tasks were last committed in May. |
| E-14 | Observed | The project UI mislabels fetch time as source freshness. | `projects/page.tsx` sets `lastSync` to `new Date()` after any successful JSON response and renders “LIVE.” It ignores source revision and source timestamps. It polls every 15 seconds but says “Auto-refresh 30s.” |
| E-15 | Observed | Fetch failures can leave stale UI without an error. | The Projects page has an empty `.catch(() => {})`; prior data can remain on screen with no stale or unavailable state. |
| E-16 | Observed | Mobile support is partial, not absent. | The repository contains mobile breakpoints, an off-canvas sidebar, single-column overrides, and prior mobile commits. |
| E-17 | Observed | Mobile acceptance coverage is absent for the reported surfaces. | No Playwright or equivalent 390px acceptance tests were found for Command Center auth, chat rehydration, Projects freshness, foreground/background restoration, or cross-device state. |
| E-18 | Observed | Mobile height and shell state remain viewport-fragile. | Core chat and page shells use `100vh` rather than a safe-area-aware dynamic viewport contract; multiple fixed overlays share the phone viewport. |
| E-19 | Observed | Existing documentation contradicts current behavior. | `CC-IMPLEMENTATION-DOC.md` says Firestore is the shared-state source and bridge, while current Projects uses GitHub/static files and current Chat uses Supabase. `CC-IMPLEMENTATION-STATUS.md` is dated 2026-05-10. |
| E-20 | Observed | The prebuilt Graphify artifact is unusable with the installed graph reader. | `graphify query` failed with `could not load graph: 'nodes'`. This audit used direct source tracing instead. |
| E-21 | Observed | Vercel deployment metadata was unavailable to this connection. | Vercel returned 403 for team scope `ramicheais-projects`. No authorization change was made. |
| E-22 | Observed | Repository verification passed for the audited helpers. | 67 focused tests passed across Cloudflare Access, chat persistence, chat routing, API security, and realtime sync. `tsc --noEmit` passed. |

## 4. Defect analysis

### P0-AUTH-01: redundant and incomplete authentication

**User impact:** The user signs into Cloudflare Access, then enters a separate PIN. The PIN repeats identity friction without establishing a reliable server-side principal.

**Failure mechanism:**

1. Cloudflare authenticates the browser at the edge.
2. The application does not consume or validate that identity.
3. The browser asks for a shared PIN.
4. A successful PIN response causes JavaScript to write a Boolean to `sessionStorage`.
5. The middleware and APIs do not receive a signed application principal from that step.

**Security consequence:** The current PIN is neither strong second-factor authentication nor application authorization. It is a client-held display gate behind Cloudflare. Sensitive API authorization is effectively delegated to the reachability of an allowed hostname and whatever Cloudflare policy sits in front of it.

**Required direction:** Keep Cloudflare Access. Validate its identity assertion at the application boundary, map it to an internal principal and role, then issue an HttpOnly app session. Move the PIN, if retained, to explicit step-up authorization for gated actions only.

### P0-CHAT-01: persisted conversations can disappear on re-entry

**User impact:** A useful conversation appears during the active session but is absent after closing and reopening.

**What is proven:** The reported Content Team turn was durably stored. Data deletion is not the incident.

**Defect seam A, proven in current main:** Production denies public browser access to chat tables, while the browser still depends on public-key reads and Realtime subscriptions. The initial load drops errors instead of rendering “history unavailable.”

**Defect seam B, proven in current main:** The app does not persist or restore the last conversation identity. A reopen may select another channel, which makes the prior conversation appear gone even when history loading works.

**Incident root-cause status:** **Partially proven.** Both defects exist. Proving which one the phone encountered requires the deployed revision, runtime network trace, or an authenticated replay on the same deployment.

**Required direction:** All private chat data must flow through an authenticated server boundary. Conversation identity, cursor, draft, and scroll anchor must be durably restored per principal and device.

### P0-PROJECTS-01: stale data presented as live truth

**User impact:** Project status looks unchanged for months because it is unchanged for months.

**Failure mechanism:**

1. The static project catalog defines status, description, owners, blockers, and fallback tasks.
2. The API optionally replaces task lists and metadata with files committed to this same repository’s `main` branch.
3. A five-minute memory cache reduces upstream reads.
4. The page polls the same sources every 15 seconds.
5. The page stamps its own fetch completion time and calls the result LIVE.

Polling stale data faster does not make it real-time.

**Required direction:** Build a source registry and normalized project read model fed by authoritative systems. Show `observed_at`, `ingested_at`, source revision, and freshness state. Never convert browser fetch time into evidence of source freshness.

### P1-CHAT-02: orchestration lacks a durable turn state machine

The current API can fan out, synthesize, critique, persist, and return. It does not expose one durable turn record that makes retries, partial completion, cancellation, reconnection, and cross-device resume unambiguous. A request timeout, lost SSE connection, or partial provider failure can leave the user unsure whether work continued.

### P1-MOBILE-01: responsive CSS exists without mobile product acceptance

The failure is not “no mobile CSS.” The failure is lack of a mobile contract and proof. The existing three-column chat is compressed by breakpoints, not redesigned around a phone’s navigation, backgrounding, keyboard, safe areas, connection switching, and one-handed use.

## 5. Current logical architecture

```text
Browser
  -> Cloudflare Access login
  -> command.parallaxvinc.com
  -> Next.js middleware host allowlist
  -> client-side PIN display gate
  -> Command Center pages

Chat page
  -> browser Supabase client for channels/messages/reactions/realtime  [blocked by live RLS]
  -> Next chat API for provider routing and agent replies
  -> Supabase service role for server writes
  -> Claude Max proxy / LM Studio / optional OpenClaw

Projects page
  -> Next projects API every 15 seconds
  -> hardcoded shared-projects.ts
  -> ramiche-site GitHub main project files, cached 5 minutes
  -> build-time local file fallback
```

This is not the target architecture. It is the evidence-backed current seam map.

## 6. Existing strengths to preserve

- Cloudflare Access already protects the public hostname.
- The provider adapter detects Access login interception and supports service-token headers for machine calls.
- The latest chat persistence layer refuses to call an unpersisted reply durable.
- Chat has real channel and thread identifiers, persisted messages, service-role server writes, idempotent schema migrations, and Realtime publication membership.
- The agent registry and chat target resolver are centralized enough to evolve rather than replace.
- Middleware blocks public Vercel aliases from exposing Command Center paths.
- Mobile breakpoints and an off-canvas navigation foundation already exist.
- Focused source-level tests and TypeScript verification pass.

## 7. Unknowns and blocked evidence

| Unknown | Why it matters | Resolution before implementation |
|---|---|---|
| Exact deployed origin and commit behind `command.parallaxvinc.com` | Determines whether the current runtime is local tunnel, Vercel, or another origin and whether `main@25f1f51` is deployed. | Read Cloudflare tunnel target and deployment revision. Record immutable SHA. |
| Cloudflare Access policy, audience, allowed identity providers, session duration, device posture, and bypass rules | Required to design SSO without weakening the perimeter. | Export or inspect the Access application and policies read-only. |
| Access identity claims actually forwarded to the origin | Determines stable principal key and claim mapping. | Capture a redacted authenticated request at the origin. Do not record raw JWTs. |
| Same-device mobile network trace for the incident | Distinguishes denied rehydration from wrong-conversation restore in the exact incident. | Reproduce after authenticated access with network and console capture. |
| Existing bridge daemon and current journal/context publication contracts | Determines which project signals already exist and avoids rebuilding RAMICHE OS. | Inspect the owning OpenClaw/RAMICHE OS repo and running bridge separately. |
| Production Vercel project state and environment presence | Needed only if Vercel is an active origin or preview target. | Authorize read access to team scope, then inspect settings without exposing values. |
| Real Safari and installed-app behavior | Chromium emulation cannot certify iOS background, keyboard, safe-area, or storage behavior. | Run acceptance on a real iPhone Safari or installed PWA and record device/OS. |

## 8. Documentation contradictions to retire

1. “Firestore is the single source of truth for all shared state” is not true for current Chat or Projects.
2. “Projects reads workspace TASKS.md” is not true on the deployed cloud path; it reads this repository’s GitHub files and local build fallback.
3. “All chat phases complete” does not include post-lockdown browser rehydration or cross-device continuity.
4. “Real-time” is used for polling and fetch time without a source freshness contract.
5. The local-machine and Vercel dual-origin narrative is not reconciled with current Cloudflare and middleware behavior.

These statements should be marked historical, not silently edited into new truth.

## 9. Forensic acceptance gate

Unrelated feature work should remain frozen while the approved evidence and remediation stages satisfy this gate. Stage 0 evidence work and separately approved Stages 1 and 2 are the permitted work needed to close it. The gate is complete only when all are true:

- [ ] The deployed origin and immutable revision are recorded.
- [ ] Cloudflare Access audience and forwarded identity claims are verified.
- [ ] A server-owned private data path replaces direct browser access for Chat.
- [ ] The Content Team turn rehydrates after reload, browser restart, and another authorized device.
- [ ] The last conversation and draft restore correctly on mobile.
- [ ] Projects no longer labels fetch time as source freshness.
- [ ] Every displayed project field has an authoritative source, source revision, and freshness policy.
- [ ] A real iPhone acceptance run covers sign-in, chat send, close/reopen, background/foreground, Projects, and error recovery.

## 10. Design doctrine applied to the specification

This audit proposes no visual redesign. The implementation specification uses these named Pantheon techniques where experience design is required:

- **LUDUS, “The Honest Loop,” Experimental:** expose source, cause, result, and failure instead of hiding the system’s wiring.
- **PRISM, “The State-Machine As Lived Experience,” Experimental:** define auth, chat, sync, and recovery from the user’s experienced states, including traps and no-feedback states.
- **PRISM, “The Mobile-First Step,” Proven-underused:** phone flow is primary; desktop is the enhancement.
- **PRISM, “The KPI Inverted-Pyramid Dashboard,” Proven-underused:** project surfaces lead with the one decision-driving status and compare it to a target or prior observation.
- **PRISM, “The Reference-Line Reframe,” Proven-underused:** freshness and SLO displays include the threshold that gives the number meaning.
- **PROTEUS, “Continuity Save-State,” Experimental:** return the user to the same authorized conversation, draft, and place across close, reopen, and device changes.

The inversion is specific: **a conventional dashboard hides asynchronous wiring behind a clean “LIVE” badge. Parallax OS will expose confidence, provenance, and recovery as first-class interface state.**
