# CC-SECURITY-RELEASE-GATE-03A: verification and the full route matrix

**Status:** verification of PR #70 and PR #71 as revised, plus the full route-by-route
authorization matrix CC-SECURITY-COMPLETION-02 left as a named gap (37 of a claimed 45 routes
grouped but not individually classified; the real total is 46, see section 3). No merge, deploy, production SQL, credential rotation, or
enforcement change was performed. No file with "clockwork" in its path was touched. `ramiche-os`
was not modified.

## 0. A finding that changes the risk picture for every route below

**Vercel's own deployment protection (not Cloudflare, not this app's code) is currently ON for
this project, and the project has no custom domain.**

Checked directly against the live Vercel project (`prj_bOKRVoxvMV8epTv12DoTBDDdMDS3`, read-only,
no setting changed):

```
passwordProtection: { enabled: false }
ssoProtection:      { enabled: true, deploymentType: "all_except_custom_domains" }
trustedIps:         { enabled: false }
domains: ["ramiche-site.vercel.app", "ramiche-site-ramicheais-projects.vercel.app",
           "ramiche-site-git-main-ramicheais-projects.vercel.app"]
```

`ssoProtection` is Vercel's own "Vercel Authentication": every response from a protected
deployment URL requires a signed-in Vercel team session (or a time-limited share link / an
automation bypass secret), enforced at Vercel's edge before the request reaches this app's code.
It is set to apply everywhere **except custom domains** — and this project has **no custom
domain** attached. So every URL this project is currently reachable at should be behind that
wall today, API routes included.

**This does not make the per-route findings below wrong; it reframes what "unauthenticated" means
right now, and names the real danger:**

1. Every finding below is about the *application's own* authorization, which is independently
   true regardless of the platform layer. Nothing in this document assumes Vercel protection
   stays in place.
2. **The moment a custom domain is attached to this project** (the obvious next step for a real
   "command center" product), `ssoProtection`'s exclusion means protection **disappears for that
   domain** while every in-repo gap found here stays exactly as open. This is a latent, not
   theoretical, risk: it fires on a routine infrastructure change, not an attack.
3. **I could not determine whether an automation bypass secret already exists** for this
   project (the kind of secret that lets a legitimate webhook caller through Vercel's wall,
   typically shipped as `VERCEL_AUTOMATION_BYPASS_SECRET`). Listing or generating one requires a
   call (`update_project_protection_bypass`) that mutates state if no secret exists yet — I did
   not make that call. Listing current env vars (`filter_project_envs`) returned `403 forbidden`
   with this session's Vercel credentials. **If such a secret exists and is attached to any
   outbound caller more broadly than one specific webhook, anyone holding it bypasses the Vercel
   wall for every path on this deployment**, and the in-repo gaps below become immediately live
   for them. This is the single most important unresolved question in this document — it needs a
   human with full Vercel project access to check (Project Settings → Deployment Protection →
   Protection Bypass for Automation), not an agent.
4. I did not send any request to the live deployment to confirm enforcement empirically (every
   prior mission in this chain prohibited that, and I kept to it here); this section reports
   configured platform settings only, read through the Vercel API, not observed behavior.

**Earlier documents in this chain (`CC-ORG-AUTHZ-SECURITY-ASSESSMENT-01`,
`SECURITY-COMPLETION-02-READINESS.md`) said the app is "protected only by Cloudflare Access at
the network edge." That is not what the code shows.** `CF_ACCESS_CLIENT_ID`/
`CF_ACCESS_CLIENT_SECRET` (`src/lib/cloudflare-access.ts`) are credentials this app sends
*outbound* to reach `openclaw.parallaxvinc.com` and `claude.parallaxvinc.com`, which sit behind
Cloudflare Access. They say nothing about whether *this* app's own deployment is behind Access.
No Cloudflare config for this project's own domain was found in the repository, and it has no
custom domain for Cloudflare to front in the first place. Treat the Cloudflare-Access-at-the-edge
claim as unverified until a human confirms whichever DNS/CDN setup actually sits in front of
`ramiche-site.vercel.app` or whatever domain is live at the time.

## 1. PR #70 re-verification (parallax containment, head `5951550`)

Re-executed independently (not re-reading the claims): rebuilt the exact live table schema
(including every column, having first re-read the full source migration rather than a truncated
excerpt) in a fresh, disposable local PostgreSQL 17 cluster. Ran, in order: the pre-fix test
(reproduces the vulnerability — insert/update/**truncate** all succeed for `anon`), the forward
migration (preflight and postflight notices fire exactly as documented), a direct `TRUNCATE`
attempt as `anon` (now `permission denied for table parallax_odds_cache`), the post-fix test
(clean pass), the rollback (policies **and** the three revoked grants restored), and a final
`TRUNCATE` attempt (succeeds again, confirming the rollback is an exact inverse). Every step
matched the branch's own claims.

**External scanner dependency — converted from "unknown" to "named, not reachable from here":**
OpenClaw's own capability registry (`~/.openclaw/CAPABILITIES.md`, this machine) names a real
service, `parallaxbet-engine` (FastAPI, EV scanner / fair-odds modeling / Kelly staking,
real-money action hard-gated to Ramon), with a flagged risk that `~/parallax` and
`~/parallaxbet-engine` are divergent copies of the same code. Neither path exists on this
(MacBook) machine as checked directly (`~/parallaxbet-engine`: not found; `~/parallax`: exists,
but is an unrelated ComfyUI workspace, a name collision, not the scanner). It may live on the
iMac, which this mission's standing restrictions forbid accessing. **This is the exact missing
evidence, not an assumption of retirement: the scanner is real, named, and not checkable from
this session.** The migration still must not be applied until a human with iMac access confirms
it one way or the other.

**Verdict: GO to merge as a draft. NO-GO to apply, pending the scanner confirmation above** (this
matches the branch's own doc; independently confirmed, not changed).

## 2. PR #71 re-verification (founder authorization, head `04682cc`)

Read `founder-authority.ts`, `pin-rate-limit.ts`, `auth/pin/route.ts`, and `auth/state/route.ts`
in full. Findings:

- HMAC-SHA256 over `issuedAt` and `expiresAt` together (not just one), `timingSafeEqual` used for
  every comparison (session MAC, PIN hash, PIN plaintext, machine bearer token), length-checked
  before the constant-time compare so a length mismatch can't throw past the check.
- The dev fallback PIN (`2451`) is correctly unreachable once `NODE_ENV === "production"`,
  regardless of `CC_PIN_ALLOW_DEV` — a fixed public PIN cannot become the production credential
  by misconfiguration of that one flag alone.
- Origin/CSRF check only runs on unsafe methods, checks Origin falling back to Referer against
  the forwarded host, and a mutation with neither header is rejected (a real browser request
  always carries one).
- The machine-credential bypass requires both a configured secret (≥32 chars) **and** the route
  being named in an explicit allow-list (default: no routes) — enabling the human guard on a
  route never silently opens a machine path to it.
- `auth/state` reveals only whether the caller currently holds a valid session; it never echoes
  PIN state, mints nothing, and sets `cache-control: no-store`.

Ran independently (not trusting the branch's own numbers): `npx vitest run` on the seven
touched/added test files → **111 passed**. `npx tsc --noEmit` → clean. Confirmed all eight named
routes (`gate`, `agents`, `settings`, `leads/send`, `voice/call`, `chat/approve`,
`chat/approve/stream`, plus the original `yolo-approve`) call `requireFounderAuthority` with a
distinct route key, and that `isFounderGuardEnforced` defaults to off (merging changes no route's
behavior).

**Verdict: GO to merge as a draft. Enforcement stays founder-driven and staged, per the branch's
own recommendation** (independently confirmed).

## 3. The full route matrix (46, not 45)

`grep -rl "export async function POST" src/app/api/command-center --include=route.ts | wc -l`
gives **46**, not 45 — a small, real correction to the mission brief and to
`CC-FOUNDER-AUTHORITY-GUARD-01.md` §6's "37 of 45" framing. Re-run the same count to confirm
before relying on either number; the list is reproduced in full below so the correction is
checkable rather than asserted. Of the 46: 8 are wired to the founder-authority guard (PR #71), 6
have a different, independently real check (§3.1), and the remaining 32 have no check of any
kind (§3.2 + §3.3). Depth of check varies by row, noted in **Confidence**: `read` = handler read
in full; `scan` = grepped for the call-chain signal (auth check, external call, write); unmarked
rows were not individually opened.

### 3.0 The 46

```
agents · auth/pin · bambu · briefing/compose · chat/action-status · chat/approve ·
chat/approve/stream · chat/mark-read · chat/pin · chat/reactions · chat/regenerate-image · chat ·
chat/stream · chat/upload · chat/webhook · crons · firestore-sync · gate · image-gen ·
jobs/[id] · jobs · leads/intel · leads/kit · leads/send · oracle · pipeline/diagnose ·
pipeline/leads · pipeline/maintenance · pipeline/proposals · prospector/daily ·
prospector/import · prospector/search · push · roadmap · security · settings · tasks/notify ·
telegram/webhook · voice/atlas · voice/call · voice/call/webhook · voice/speak ·
voice/transcribe · wellness/verse · ws · yolo-approve
```

(all under `src/app/api/command-center/`, each a `route.ts`)

### 3.1 Already protected — verified real check (6, unwired by this guard but not unauthenticated)

| Route | Check | Confidence |
|---|---|---|
| `auth/pin` | PIN hash/plaintext, timing-safe, now rate-limited | read |
| `chat/webhook` | Bearer token against `OPENCLAW_CC_WEBHOOK_TOKEN`/`OPENCLAW_GATEWAY_TOKEN` | read |
| `crons` (POST) | `x-bridge-secret` header against `BRIDGE_API_SECRET` | read |
| `push` | `x-cc-push-secret` header or bearer against `CC_PUSH_SECRET` | scan |
| `telegram/webhook` | `verifyTelegramWebhookSecret()` against `TELEGRAM_WEBHOOK_SECRET` | scan |
| `security` | no inbound check, but the route only *probes other routes* for 401/403 and reports; its own effect is a read, not a mutation | scan |

### 3.2 P0 — no check, real external send or spend, or infrastructure-level control

| Route | Effect | Recommended policy | Confidence |
|---|---|---|---|
| `jobs`, `jobs/[id]` | `runJob` can run **tool-enabled Claude Code with permissions skipped** against an allowlisted working directory (`CC_BUILDER_ROOTS`); gated only by a path allowlist, not caller identity | founder guard, machine-route if a legitimate automation needs it | read (jobs), scan (jobs/[id]) |
| `voice/call/webhook` | Vapi end-of-call webhook. Previously no check at all: wrote attacker-controlled transcript text into `pipeline_leads.meta` for a caller-chosen `leadId`, and spent an LLM call extracting a "discovery brief" from that text on every call | **fixed in this PR**: opt-in `x-vapi-secret` check (its own function, not `verifyMachineCredential`, since Vapi's header differs from the generic bearer scheme), gated by the same `CC_FOUNDER_GUARD_ENFORCE` + `CC_MACHINE_ROUTES` pair as every other route here, off by default, checked only on the message type that actually writes anything. Still requires a human to configure the matching `server.secret` in the Vapi assistant config (outside this repo) before enabling — the code half alone does nothing until that lands too. 8 new tests. | read, fixed |
| `oracle` | Proxies directly to `https://api.anthropic.com/v1/messages` with no caller check | founder guard or machine secret — an open proxy to a paid LLM API is a direct spend vector | scan |
| `image-gen` | Generates images (named "requires: prompt, agentId, channelId" in its own schema) — spend vector | founder guard | scan |
| `firestore-sync` | Reads local filesystem paths hardcoded to `/Users/admin/.openclaw/workspace` (the iMac's layout) and writes to Firestore; no check | founder guard | scan |
| `bambu` | Writes a local status file for 3D-printer control (`writeFileSync`); whether it also issues real print commands wasn't fully traced | founder guard, out of caution (physical-world effect category) | scan |
| `voice/call` | Already wired (listed here only for completeness; outbound call to a caller-supplied number) | — | — |

### 3.3 P1 — no check, real but lower-severity state mutation (CRM/content/chat data)

| Route group | Routes | Effect | Confidence |
|---|---|---|---|
| Pipeline/CRM | `pipeline/leads`, `pipeline/diagnose`, `pipeline/maintenance`, `pipeline/proposals` | mutate lead/pipeline records | scan |
| Lead intel | `leads/intel`, `leads/kit` | LLM calls scoped to one `leadId`; cost but not external send | scan |
| Prospecting | `prospector/daily`, `prospector/import`, `prospector/search` | likely scraping/import; cost and possibly outbound requests | scan |
| Chat mutations | `chat/mark-read`, `chat/pin`, `chat/reactions`, `chat/regenerate-image`, `chat/upload`, `chat/action-status` | mutate chat state (read/pin/react/regenerate/upload); regenerate-image also spends on generation | scan |
| Chat relay | `chat`, `chat/stream` | the main relay; `resolveChatTargets`'s `bootstrapMode` fix is tracked separately in PR #68, not duplicated here | — |
| Content/ops | `roadmap`, `wellness/verse`, `tasks/notify`, `briefing/compose` | local JSON file write (`roadmap`), Supabase upsert (`wellness/verse`), notification store write (`tasks/notify`); `briefing/compose` showed no persistence in a grep pass, unverified further | scan |
| Voice (non-wired) | `voice/atlas`, `voice/speak`, `voice/transcribe` | voice-loop/TTS/STT; cost vector, no external send to a third party beyond the configured provider | scan |
| `ws` | message bus submission; severity depends on what consumes the bus, not traced | scan |

**None of 3.3 was read in full.** The grouping is a reasonable first pass from the route name,
its one-line doc comment, and a grep for `.insert(`/`.update(`/`fetch(`/`writeFile`-style calls;
treat the per-route severity as indicative, not final, until someone reads each handler the way
§3.1 and §3.2's `read`-confidence rows were read.

### 3.4 Reconciliation

8 wired (§2) + 6 already protected (§3.1) + 7 P0 with no check (§3.2, excluding `voice/call`,
listed there only for completeness since it is already wired) + 25 P1 with no check (§3.3) = 46.
Recomputed by set subtraction from the 3.0 list, not hand counted, and matches `wc -l` above. If
a future re-run of the route count disagrees with 46, that is itself a finding worth chasing
down, not a reason to revert to 45.

## 4. Distributed rate limiter

PR #71's PIN limiter is explicitly per-instance (documented honestly, not hidden): on Vercel, the
real ceiling is `instances x 5` guesses per 15-minute window, not 5. Evaluated, not built, per
this mission's instruction:

- **Upstash Redis** (Vercel's own marketplace integration, `@upstash/ratelimit`) is the standard
  fit: a Vercel project already on the platform, no new infrastructure to run, a sliding-window
  limiter with one extra round trip per PIN attempt. This is the recommended option if an exact
  global count is wanted.
- **A Supabase table** (the project already has a database) avoids a new vendor but adds a write
  path and a new failure mode to the unlock screen (if Supabase is slow or down, does the PIN gate
  fail open or closed?) — this question would need an explicit answer before building it.
- **Do nothing further yet**: the per-instance limiter already cuts a brute force from unlimited
  to a small number per warm lambda, and the PIN is a human-chosen secret, not a per-user
  password an attacker is likely to already know a format for. Given this is the recommended path
  while routes remain the bigger exposure, building a distributed limiter now would be effort
  spent on the smaller problem.

**Recommendation: do not build this now.** Revisit once the 32-route no-check gap in §3 is closed; a
distributed PIN limiter matters far less than an open `jobs` or `oracle` route.

## 5. npm audit blockers

`main`'s `security` CI job fails on `npm audit` (2 critical, 22 high, per the job log). Confirmed
unchanged on `main` @ `25f1f51` and identical on both PR branches (neither touches a dependency).
The only remediation GitHub's own output offers is `npm audit fix --force`, which it flags itself
as a breaking change (forces a `zod`/`shadcn` downgrade). This is a repo-wide dependency decision,
not something scoped to either PR in this mission, and stays outside this mission's scope per the
standing rule against unapproved dependency changes.

## 6. GO / NO-GO

| Action | Decision | Why |
|---|---|---|
| Merge PR #70 (draft → mergeable) | **GO** | Re-verified; inert (SQL file, not applied) |
| Merge PR #71 (draft → mergeable) | **GO** | Re-verified; inert (guard off by default) |
| Apply PR #70's migration to production | **NO-GO** | External scanner confirmation still outstanding (§1 of this doc) |
| Enable `CC_FOUNDER_GUARD_ENFORCE` for any route | **NO-GO**, until: secret set, PIN re-entered, one route verified in the browser, per the existing rollout plan | Nothing here changes that plan |
| Enable `CC_FOUNDER_GUARD_ENFORCE=all` | **NO-GO** | 32 routes still have no check at all; §3.2's P0 group (`jobs`, `oracle`, `image-gen`, `firestore-sync`, `bambu`, `voice/call/webhook`) should be wired and verified before any blanket enforcement is even considered |
| Confirm whether a Vercel protection-bypass secret exists and how widely it's shared | **Open, human action required** | Cannot be resolved by this session (§0); the single biggest unknown left standing |
| Rely on "Cloudflare Access at the edge" as a stated mitigating control in future docs | **Retract** | Not supported by what's in this repository (§0); replace with a verified statement of whatever actually fronts the live domain |

No production SQL was run, no deployment was made, no credential was rotated, and no enforcement
flag was set, by this or any prior lane in this chain.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
