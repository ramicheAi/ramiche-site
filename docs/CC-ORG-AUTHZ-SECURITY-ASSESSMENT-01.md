# CC-ORG-AUTHZ-SECURITY-ASSESSMENT-01

**Status:** read-only security assessment. No code behavior changed in this PR. No migration in
this PR was applied against the live database. No request was sent to any deployed URL; every
Supabase statement run while preparing this document was a read-only `SELECT`.

**Companions:** `ramicheAi/ramiche-os#56` (organizational contracts), `ramicheAi/ramiche-site#68`
(channel authorization design). This PR is independent of both and of Clockwork (`ramiche-os`
PR #49); it touches no file in either.

**Scope:** every route under `src/app/api/`, plus the Supabase authorization boundary for the
tables those routes touch.

## 1. Method

For each route: read the handler source, trace the call chain from the top of the function to the
first database write, outbound send (email/SMS/voice/webhook), or credential-touching call, and
record whether a check exists on that path before the effect. Classified into exactly one of:

- **Explicit route-level authorization** — the route itself checks a credential/signature/secret
  before acting.
- **Effective protection inherited from middleware or a shared server function** — checked
  `src/middleware.ts` and any shared `lib` auth helper the route actually imports.
- **Service-role database access with verified caller authorization** — service-role key use AND
  an explicit check, both present.
- **Gap identified by code review** — the call chain from request to effect has no check in
  between, established by reading the source, not by sending a request.
- **Unknown or untested exposure** — depends on something outside this repo (Cloudflare Access
  configuration, a production env var's actual value, Firestore security rules) that cannot be
  confirmed from the code alone.

Cloudflare Access sits in front of the deployment at the network edge, outside this repository.
It is a real control, but it cannot be confirmed from here, so it is never treated as a substitute
for an in-repo check below — a route with no in-repo check is recorded as a gap regardless of
whatever network-edge protection may or may not apply to it in practice.

## 2. `src/middleware.ts`

Reads `x-forwarded-host` (falling back to `host`) to route by tenant hostname. It does not check
who sent the request — no session, token, or secret is examined. It is not an authorization
control for any route below; nothing in this document credits it as one.

## 3. Findings matrix — P0 (can modify missions, jobs, messages, agents, channel membership,
credentials, or money-adjacent/outreach records)

| Route | Effect | Classification | Evidence (file:line) |
|---|---|---|---|
| `api/command-center/chat/gate/route.ts` | Approves a pending founder-gate draft and dispatches it (including an outbound send) | Gap identified by code review | No credential check anywhere in the handler before the approval branch runs; the only "identity" recorded is a string field the caller's own request body supplies |
| `api/command-center/auth/pin/route.ts` | Issues the cockpit "unlock" | Gap identified by code review | Returns a success body with no cookie, token, or server-side session created; the unlock state is kept in the browser's own `sessionStorage` (`command-center/layout.tsx`), which no API route reads back |
| `api/command-center/chat/route.ts`, `chat/stream/route.ts` | Agent dispatch and chat relay | Service-role database access, no caller authorization | Uses the service-role key; no inbound check; `resolveChatTargets()` trusts client-submitted channel membership (tracked separately in `ramiche-site#68`) |
| `api/command-center/chat/approve/route.ts`, `chat/approve/stream/route.ts` | Synthesis approval and handoff dispatch | Gap identified by code review | No inbound check before the approval/dispatch effect |
| `api/command-center/chat/action-status/route.ts`, `chat/mark-read/route.ts`, `chat/pin/route.ts`, `chat/reactions/route.ts`, `chat/regenerate-image/route.ts` | Mutating chat-state writes | Service-role database access, no caller authorization | Each uses the service-role key with no inbound check |
| `api/command-center/jobs/route.ts`, `jobs/[id]/route.ts` | Create/modify jobs sent to the Claude Code proxy | Gap identified by code review | No inbound check before a job is created or its state changed |
| `api/command-center/yolo-approve/route.ts` | Writes an approval decision, attributed to Ramon by name, into agent memory files | Gap identified by code review | The attribution string is a literal in the handler, not derived from any verified caller identity |
| `api/command-center/agents/route.ts` (POST) | Agent roster update; can also trigger a gateway restart | Gap identified by code review | No inbound check on the POST path |
| `api/command-center/settings/route.ts` (POST) | Settings update, including cron enable/disable | Gap identified by code review | Note: `api/command-center/crons/route.ts` POST has its own real check (`x-bridge-secret`); this settings path changes cron state without going through it |
| `api/command-center/leads/send/route.ts` | Sends outbound email to a caller-supplied address | Gap identified by code review | No inbound check; the destination is taken from the request body, not from a server-resolved/approved list |
| `api/command-center/pipeline/leads/route.ts`, `pipeline/proposals/route.ts` | Lead/proposal record mutation | Gap identified by code review | No inbound check before the write |
| `api/command-center/voice/call/route.ts` | Places an outbound call (Vapi) to a caller-supplied number | Gap identified by code review | No inbound check; TCPA-relevant per Business Bible doctrine, flagged in `ramiche-site#68` §1 already, restated here as a confirmed authorization gap rather than a documentation note |
| `api/command-center/voice/call/webhook/route.ts` | Inbound Vapi webhook | Gap identified by code review | No shared-secret or signature check comparable to the Telegram/push webhooks |
| `api/push/send/route.ts` (outside Command Center) | Push notification dispatch | Gap identified by code review | No inbound check; distinct from `api/command-center/push/route.ts`, which does have one |

**Database, confirmed live and currently effective (not latent):**

| Table | Finding | Evidence |
|---|---|---|
| `public.parallax_bets` | `anon` role has active policies: `SELECT` (`qual: true`), `INSERT` (`with_check: true`), `UPDATE` (`qual: true`, no `with_check` restriction) | Read directly from `pg_policies`; this is the current, effective authorization state of the table, not an inference. Any caller holding the public anon key can read every row and insert or update any row with no restriction. |
| `public.parallax_odds_cache` | Same three policies, same shape, same role | Read directly from `pg_policies` |
| `parallax.bets`, `parallax.odds_snapshots` | `public` role has an active `SELECT` policy (`qual: true`) on both | Read directly from `pg_policies`. Read-only exposure (no corresponding write policy on these two), but open to any caller, authenticated or not. |

This pair is the most severe finding in this assessment: unlike the stale-grant group below, these
policies are the actual, currently enforced authorization rule for the table. No further step is
needed to make this effective; it already is.

## 4. P1 (mutates state, lower blast radius than P0, or spends money without a side channel beyond
the record itself)

`api/command-center/briefing/compose/route.ts`, `bambu/route.ts`, `calendar/route.ts`,
`chat/upload/route.ts`, `content/route.ts`, `firestore-sync/route.ts`, `image-gen/route.ts`,
`oracle/route.ts`, `pipeline/diagnose/route.ts`, `pipeline/funnel/route.ts`, `pipeline/icp/route.ts`,
`pipeline/maintenance/route.ts`, `prospector/daily/route.ts`, `prospector/import/route.ts`,
`roadmap/route.ts`, `voice/atlas/route.ts`, `voice/speak/route.ts`, `voice/transcribe/route.ts`,
`wellness/verse/route.ts` (POST), `yolo-builds/route.ts`, `api/notifications/send/route.ts`,
`api/stripe/portal/route.ts`: each mutates state (writes a file, a Firestore document, a roster
entry, a lead/content record, or calls an external provider) with no inbound check found in the
handler. None reaches a database table with as broad an exposure as §3's database findings, and
none is a founder-gate or outbound-send-to-a-real-person path the way the P0 group is.

**Stale grants, confirmed not currently exploitable (latent only):** `public.jobs`,
`public.daily_verses`, `public.job_events`, `public.pipeline_events`, `public.pipeline_gate`,
`public.pipeline_leads`, `public.pipeline_proposals` all carry `anon`/`authenticated` GRANTs
(`INSERT`/`UPDATE`/`DELETE`/etc.) left over from an earlier migration. Each has `relrowsecurity =
true` and zero policies, and neither `anon` nor `authenticated` has `BYPASSRLS` (confirmed against
`pg_roles`), so Postgres denies every row to those roles today regardless of the stale grants. This
is a defense-in-depth gap, not a live exposure: if a permissive policy is ever added to one of these
tables for an unrelated reason, the stale grants become live immediately. Proposed, unapplied
`REVOKE` statements for this group are in
`supabase/migrations/20261108190000_revoke_stale_anon_grants.sql`.

## 5. Investigations requested by the mission

**The `channel_members` anomaly is a UUID collision, not bad data.** The five real membership rows'
`agent_id` values are genuine `agent_profiles.id` values — confirmed directly: `agent_profiles.id =
'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'` is Atlas (`handle: "atlas"`), seeded 2026-03-10. The same
literal UUID is separately used as `channels.id` for "Strategy Team," seeded later, 2026-05-13. The
two seed scripts each independently chose simple repeated-hex-digit UUIDs and happened to collide.
Any code that joins `channel_members.agent_id` against `channels.id` instead of `agent_profiles.id`
would silently resolve to the wrong table's row. This is a data-integrity hazard worth fixing
(give agents and channels non-colliding id ranges, or stop using human-legible placeholder UUIDs in
a shared id space), independent of any authorization question.

**The nine duplicate-name channel pairs are two different situations, not one.** Eight pairs
(Content, Creative, Finance, Legal, Sales, Security, Strategy, Wellness Team) are a March-seed row
next to a May-seed row for the same team; the March row is not uniformly empty history, though —
at least one (the March "Creative Team" row) carries real message history and must not be silently
archived as if it were empty. The ninth pair, two "DM: Triage" rows, is not part of that pattern: the
second row (2026-10-03) has its own distinct title and appears to come from a multiple-DM-
conversations feature that exists only on unmerged branches, ahead of what is on `main` today. Those
branches also carry an owner-identity/origin/CSRF guard (a shared `protected-mutation.ts`-style
helper) that `main` lacks; that guard is the natural basis for closing several of the P0 gaps above,
once it lands, rather than inventing a new one here.

## 6. Remediation, by group (described, not implemented in this PR)

1. **The approval/execute path (`gate`, `yolo-approve`, `chat/approve*`, `jobs*`):** add one shared
   server-side check, applied before any of these handlers runs its effect, that establishes a real
   caller identity (not a request-body string) and records it as the approver — the owner-
   identity/origin/CSRF guard referenced in §5 is the closest existing design to build this from.
2. **Outbound-send paths (`leads/send`, `voice/call`, `push/send`):** require the same check, plus a
   destination allow-list or an explicit founder approval record per the Business Bible's outreach
   gate, rather than trusting a caller-supplied destination.
3. **`parallax_bets`/`parallax_odds_cache`:** drop the `anon` `INSERT`/`UPDATE` policies (proposed in
   the migration file); keep or drop the `SELECT` policies based on a product decision about whether
   this data is meant to be publicly readable.
4. **`parallax.bets`/`parallax.odds_snapshots` public `SELECT`:** same product decision on public
   readability; this is exposure, not a write risk.
5. **Stale grants (7 tables):** revoke per the proposed migration once each table's actual
   anon/authenticated `SELECT` need (if any) is confirmed.
6. **`auth/pin`:** either make it issue a real server-verified session (cookie/token checked by
   every route below it) or remove it as a security boundary entirely and rely only on Cloudflare
   Access, stating that choice explicitly rather than leaving a gate that looks like it works but
   does not.

## 7. Caveats — what this assessment could not establish

- Cloudflare Access's actual configuration cannot be read from this repository. The Vapi and
  Telegram webhook endpoints have to be reachable from the public internet by design, which implies
  Access has at least some bypass path for them; its exact shape is unknown here.
- Whether `TELEGRAM_WEBHOOK_SECRET` is actually set in production is unknown; the code falls open
  (accepts every request) if it is unset.
- Whether the two unauthenticated Firestore REST writes (`tasks/notify`, `crons` GET) are actually
  dangerous depends on Firestore security rules that live outside this repository and were not
  checked.
- Whether `x-forwarded-host` can be spoofed through whatever sits in front of this deployment
  (Vercel, Cloudflare) was not established from the repository alone.
- Read-only routes were not individually tabulated; none of them reached a mutating effect in the
  handlers reviewed, so none is listed as a P0/P1 finding, but a full enumeration was not attempted.
- This is a Claude-authored review of Claude/human-authored code in the same family of models as
  other recent changes in this repository; it is a context-separated pass, not independent review
  in the sense an external auditor would provide.
