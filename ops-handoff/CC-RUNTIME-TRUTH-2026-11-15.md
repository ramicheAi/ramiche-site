# Command Center runtime truth and iPhone defect matrix

**Date:** 2026-11-15
**Scope:** CC-PRODUCTION-TRUTH-RECOVERY-01, Gate 0 and Gate 5 assessment
**Status:** Investigation. No DNS, alias, auth, secret or production change was made.

---

## 1. What actually runs where

Probed live on 2026-11-15, not inferred from the repo.

| Origin | DNS | Front door | What serves it |
|---|---|---|---|
| `command.parallaxvinc.com` | Cloudflare `104.21.56.22`, `172.67.175.252` | Cloudflare Access, 302 to `calm-firefly-c94b.cloudflareaccess.com`, sets `CF_AppSession` | The same Next.js Command Center app, served by the iMac `com.command-center` LaunchAgent behind a Cloudflare tunnel (`CC-DESIGN-PROMPT.md`). Full local filesystem and agent access. |
| `ramiche-site.vercel.app` | Vercel `64.29.17.3`, `216.198.79.3` | Vercel, `server: Vercel` | The same app on Vercel, plus the marketing site. No iMac filesystem, so filesystem-backed panels degrade. |
| `parallaxvinc.com` | Vercel `76.76.21.21` | Vercel | Marketing site. Redirect target of the old `parallax-site` project. |
| `cockpit.parallaxvinc.com`, `admin.parallaxvinc.com` | no A record | n/a | Do not exist. |

Both Command Center origins are reachable only with an authorized session. The Vercel origin additionally requires the trusted-device bootstrap or an approval code; it returned 307 to `/command-center/bootstrap` for all 15 audited routes with no session, and 401 from `/api/command-center/*`.

### Installed PWA

Not verifiable from this machine. The installed app's origin, manifest and service worker live in iOS storage, and the six screenshots do not show a URL. The Command Center manifest is origin-scoped (`/manifest-command-center.webmanifest`, `id` and `start_url` `/command-center`, `scope` `/command-center`), so whichever origin installed it owns its own storage and its own service worker. **Owner confirmation required before any alias, DNS or manifest change.**

### Consequence that explains several defects

The two origins are not equivalent. Anything reading the iMac filesystem (YOLO builds, local agent registry) works on the tunnel and cannot work on Vercel. Anything hardcoding a "plausible" fallback therefore shows different numbers depending on which origin the phone installed. That is the mechanism behind `$48.2k` on the phone while the desk shows something else.

### Canonical URL recommendation

Recommend **`command.parallaxvinc.com`** as the single operational cockpit:

- it is the only origin with the authoritative filesystem, agent registry and build inventory;
- it already sits behind Cloudflare Access, which is a second gate in front of the app's own device trust;
- Vercel then becomes the marketing site and a read-only fallback, never a second cockpit.

This is a recommendation only. Aliases, DNS, Access policy and re-installation all stay with the owner.

---

## 2. The six screenshots, as evidence

Files: `IMG_7480.PNG` to `IMG_7485.PNG`, 1320x2868 (440x956 at 3x), captured 08:26 to 08:34 on 2026-11-15, immediately after `dpl_4CE9NVwJZPnwCaFHxLNmsye91uTQ` went live.

| # | Screen | Observed defect | Root cause | Addressed by |
|---|---|---|---|---|
| 7480 | Sanctuary | HUD search bar sits on top of the "SANCTUARY" wordmark and the status line; truth line reads `$48.2k MRR`; bottom bar shows a `⌘K` hint | `.sanc` is `position: absolute; inset: 0` inside a `position: static` content column, so it ignores the HUD inset. Money came from `STAT_DEFAULTS` and `STARS[...].ct` | Money: PR #92. HUD overlap: **not yet fixed** (needs a `top` inset on `.sanc` at phone widths). |
| 7481 | Chat | Channel header `#mettle` and `24 MEMBERS` sit under the HUD; channel renders empty | Chat root offset was `56px` without `env(safe-area-inset-top)`, so the safe-area height was lost. Empty channel was a denied browser read rendered as "no messages" | Inset: PR #91. Read: PR #93 |
| 7482 | Chat, keyboard up | Composer floats mid-screen, conversation gone, `Enter to send / Shift+Enter` shown on a phone | Root sized with `100dvh`, which iOS does not shrink for the keyboard | PR #93 |
| 7483 | Agents / model picker | Native picker lists nine hardcoded models; page header sits under the HUD and shows `STATIC FALLBACK` | Hardcoded `AVAILABLE_MODELS`; stale agent-status fallback | Model list: **not yet fixed** (Gate 3). Header: PR #91. Fallback badge: Gate 3 territory. |
| 7484 | YOLO Builds | Filter chips collide with their own subtitles and run to the screen edge; `0 AGENTS` beside a dashboard claiming 21; two contradictory empty states | Chip grid has no wrapping/min-width; the page reads a different source than the dashboard; the empty states do not distinguish "not loaded" from "none" | **Not yet fixed** (Gate 4) |
| 7485 | Finance HQ | `$49.4k` MRR `LIVE`, `6.0% WoW`, `$593k ARR`, `+$31,000 Cirrus AI`, `ledger · live sync` | `useState(48200)`, random drift every 1.5s, a fake `TX_POOL`, a permanent LIVE tag | PR #92 |

---

## 3. Gate status

| Gate | State | Evidence |
|---|---|---|
| 0. Runtime truth | **Done** (this document) | Live DNS and header probes, capability comparison, canonical recommendation |
| 1. Financial containment | **Draft PR #92** | Shared truth model, measured-only across Finance HQ, HUD, Sanctuary, Stage, CommandView; unavailable and genuine-zero tests; runtime proof with no Stripe key |
| 2. Chat recovery | **Draft PR #93** | Server-authorized reads and writes rebased onto main; persistence, replay, 409, 502-on-failure and keyboard receipts |
| 3. Fleet model authority | **Not started** | Requires the iMac registry contract. Hardcoded list still ships. |
| 4. YOLO builds truth | **Not started** | Needs the authoritative builds source and its lifecycle before any manifest/API. |
| 5. Layout and PR reconciliation | **Assessed, not merged** | PR #91 reviewed: correct base for drawer/HUD stacking and safe-area insets. Does not cover the Sanctuary absolute-position overlap or the YOLO chip collisions. |

---

## 4. Integration order

1. **#92 finance truth.** Independent, no schema change, removes active misinformation.
2. **#93 chat recovery.** Depends on current auth; do not apply the idempotency migration until authorized.
3. **#91 shell remediation.** Rebase after #93, since both touch the chat root height.
4. Sanctuary inset and YOLO chips as a small follow-up on top of #91.
5. Gate 3 and Gate 4 only after the iMac source contracts are documented.

## 5. Blockers and the smallest authorization

- **Blocked on owner input:** which origin the iPhone installed (decides the PWA/service-worker work), and whether the idempotency migration may be applied.
- **Blocked on machine access:** iMac registry and builds source for Gates 3 and 4. The MacBook cannot inspect them.
- **Smallest authorization for the next step:** approve merging #92 and #93 into `main` after review. No DNS, alias, secret, migration or auth change is included, and neither PR deploys itself.

## 6. Honest limits

- All browser verification in this recovery used Playwright with iPhone metrics and an emulated visual viewport. That is not a physical iPhone.
- The authenticated chat receipts ran against an isolated Postgres + PostgREST stack built from the repo migrations, not the production database.
- **PRODUCT GO stays withheld until the real iPhone passes.**


---

## 7. iMac reconnaissance (read-only, 2026-11-15)

SSH to the iMac (`admin@100.118.84.5`, host `C02YW21CJWF2`, macOS 15.7.9) is available from the MacBook over Tailscale. Everything below was read, nothing was changed.

### What the tunnel actually serves

| Item | Value |
|---|---|
| Runtime directory | `/Users/admin/cockpit-releases/41d183a0` (pinned release, not the git repo) |
| Release commit | `41d183a0`, 2026-10-05, "P06 M5C: Parallax OS pages carry their own title and manifest (#46)" |
| Next build id | `O_2PPHl3Wjiq0d_uIj5ZD` |
| Next version | 16.2.4 |
| Process | `com.command-center` LaunchAgent, `next start -H 127.0.0.1 -p 3000`, `NEXT_DIST_DIR=.next-cc` |
| Front door | `com.command-center-tunnel` (Cloudflare tunnel) plus Cloudflare Access |
| Repo on the iMac | `~/ramiche-site` on `simplify/cc-retire-unused`, last commit 2026-08-28, not the deployed tree |

The release is **six weeks behind `main`** and does not contain the mobile shell work: `CommandHUD.tsx` has no `po-menu-btn`, no "Open navigation", and no `cc:toggle-nav` listener.

**Inference, not fact:** the six screenshots show the mobile HUD with the hamburger and search bar, which only exists in the post-#90 code. The installed app is therefore most likely running the Vercel origin, not the tunnel. Owner confirmation is still required, because a re-install or a stale service worker changes the answer.

### Fleet model authority

- The authoritative registry is `/Users/admin/.openclaw/openclaw.json`, read by the gateway at startup (`models.mode: merge`).
- Real providers and model ids include `claude-max` (`claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-sonnet-4-5-20250929`, `claude-sonnet-4-6`, `claude-haiku-4`) behind `127.0.0.1:3456`, plus `minimax`, `apple-fm`, `lmstudio` and `alibaba-modelstudio`.
- 21 agents are configured, each with `primary` and `fallbacks`, for example `main -> claude-max/claude-opus-5`.
- The cockpit UI ships nine hardcoded choices (`Claude Opus 4.6`, `Kimi K2.5`, `Gemma2 9B`, ...). Every one of them is wrong or stale relative to the registry. `Gemma2 9B` does not exist; the registry has `gemma-4-e4b`.
- **The write path is not authoritative.** `/api/command-center/agents` POST writes `~/.openclaw/agents/directory.json`, a separate list-shaped file last touched 2026-07-12. The runtime never reads it. A model change therefore returns `{ok:true}` while the fleet keeps its old model. That is the exact "claims success on Vercel when the registry cannot be written" failure.
- `~/.openclaw/openclaw.json` is the only thing that changes behaviour, and the gateway exposes **no config or model tool** over `/tools/invoke` (verified tool list: `web_search`, `browser`, `web_fetch`, `message`, `cron`, `gateway`, `agents_list`, `sessions_*`, `image`, `nodes`, `canvas`, `subscribe`). Any correct implementation must write `openclaw.json` atomically, validate the model against the provider catalogue, then re-read it and report what actually landed.
- Gateway health is reachable: `GET http://127.0.0.1:24511/health` returns 200.

### YOLO builds

- Authoritative inventory on disk: `/Users/admin/.openclaw/workspace/builds` (405 entries, but the directory also holds `builds.json` and `feature-designs`, so the true build count is lower).
- `builds.json` holds 177 entries, oldest 2026-03-02, **newest 2026-07-13**. Nothing has been added in four months.
- The cockpit route `/api/command-center/yolo-builds` reads the filesystem with `readdirSync`, so it can only be correct on the iMac, never on Vercel. The Vercel copy shows an empty or stale list, which is what the phone saw.
- There is no `observedAt`, no freshness field and no failure state in the current response. The page shows "No builds loaded, waiting for YOLO builds API" and "No builds yet for this agent" at the same time.

### Operational API boundaries

- Mutations are guarded by `guardProtectedMutation` (owner/founder authority, CSRF).
- Server-to-gateway calls go through `gatewayToolsInvoke` with a bearer token from `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD`.
- `/tools/invoke` requires POST plus a bearer token and rejects anything else with 401/405.

---

## 8. Canonical runtime comparison

| Criterion | A. iMac self-hosted canonical | B. Vercel frontend + iMac APIs | C. Hybrid, explicit live/unavailable |
|---|---|---|---|
| Security | Access plus app device trust, single origin, no data in a third party | Two public front doors, CORS and token forwarding to the tunnel, larger attack surface | One door per role, but every panel must carry its mode |
| Reliability | Dies with the iMac, the tunnel or a release | UI stays up, panels fail per source | UI stays up, degraded panels say so |
| Offline / PWA | Full capabilities while the iMac is reachable | Half the cockpit is dead offline | Predictable: cached shell, live panels marked unavailable |
| Cost | Existing hardware | Vercel plus tunnel | Both, but no duplicated cockpit |
| Maintenance | One deploy target, pinned releases | Two code paths, drift already observed (six weeks) | One source of truth, two adapters |
| Failure recovery | Restart the LaunchAgent; a stale release is easy to spot | Vercel rollback independent of the tunnel | Same, with visible provenance |
| Correctness of data | Full filesystem and registry access | Cannot write the registry, cannot read builds | Correct by construction: live only where authoritative |

**Recommendation: C, implemented as B moving toward A.** Keep Vercel for the marketing site and for a resilient shell, make `command.parallaxvinc.com` the canonical operational origin, and make every data panel declare `live`, `stale` or `unavailable` with its source and `observedAt`. Gates 3 and 4 then become honest on both origins instead of silently wrong on one. This is a recommendation only: no alias, DNS or Access change is part of this work.

## 9. iMac access status

Access is available and was used read-only. The remaining blocked question is not connectivity, it is contract: which endpoint may write `openclaw.json` (a new gateway config tool, or a guarded route on the iMac), and whether the pinned release should be advanced before any of this ships.


---

## 10. Integration reconciliation (Phase B)

Merged locally, in order, into `integration/cc-recovery-02` off `origin/main` at `96b7e717`. Nothing was pushed to `main` and no PR was merged.

| Step | Ref | Result |
|---|---|---|
| 1 | #92 `1649474` | clean |
| 2 | #93 `0e97794` | clean |
| 3 | #91 `7144acbb` | clean |

Code merges without conflict. **One test conflict**, which is the real coupling between #91 and #93:

- `shell-invariants.test.ts` asserted the phone chat height as a literal `100dvh - 94px`. #93 replaced that with `calc(var(--cc-vvh, 100dvh) - 94px)` so the composer follows the iOS keyboard. The assertion failed on the `)` before `- 94px`.
- Reconciled by widening the assertion to accept either form while still requiring the 94px ticker allowance. That is the only change needed to land #91 after #93.

Combined result on the integration branch: **1039 tests passed, 2 expected fail, 4 skipped (91 files), `tsc` clean, production build clean.**

### Recommended order

1. #92 finance truth.
2. #93 chat recovery.
3. #91 shell remediation, with the assertion update above.
4. Sanctuary inset and YOLO chips on top of #91.

### Shared surfaces to watch

- `chat-root` height: #93 owns the mobile rule (viewport variable), #91 owns the tablet and desktop rule (content column). They do not conflict today, but the desktop rule still uses `100dvh`, so a tablet keyboard is not accounted for.
- 44px targets: #91 replaced the blanket `button` rule with a targeted list. #92 and #93 add no new buttons.
- `CommandHUD`: #92 edits the MRR readout, #91 edits the drawer and quick controls. Disjoint lines.


---

## 11. Independent review (Phase A)

Two fresh-context agents, neither of which wrote the code, reviewed each PR at its exact head. Both used read-only worktrees, ran the suites and `tsc` themselves, and were told not to rubber-stamp.

| PR | Final head | Verdict | What the reviewer independently confirmed |
|---|---|---|---|
| #92 | `ce071f71fb2f3c1c6c1d8ff5a7204c4ed7cb48cb` | **APPROVE** | Both P1s closed (HUD dock and revenue page no longer print unmeasured zeros), the reports P&L no longer invents a -$3,200 loss, genuine zero preserved, malformed timestamps rejected, demo only behind `?demo=1`, no auth or tenant path weakened, build green |
| #93 | `97377128bc77ebaff94230e3d5a62c4839165dac` | **APPROVE** | Server-side authorization owner-gated with no IDOR, no browser writes to `messages`, distinct read/persistence/relay errors, replay now key-order safe, 16px input, viewport-variable keyboard sizing, middleware untouched, 958 tests green |

### Defects the reviews found and I fixed

Real defects, not style notes, and the reason the review loop was worth running:

1. **HUD revenue dock printed `$0` for every value during an outage.** It now goes through the same measured-or-em-dash rule as the rest of the app.
2. **`/command-center/revenue` printed four zeros from an HTTP 200 "unavailable" body**, turning an outage into a measured $0. Now gated on `source === live`.
3. **Reports printed a fabricated loss**: green `$0.00` revenue minus real `$3,200.00` expenses, shown as a red `-$3,200.00` result. Both the revenue and the P&L are now null unless the source is live, with a neutral card instead of a red one.
4. **Chat replay compared request JSON with a jsonb read-back**, and Postgres returns keys sorted, so a genuine retry would have been answered 409 while the row existed. Comparison is now canonical JSON with a test using the client's real metadata shape.
5. **The "money surfaces" guard certified files it did not really cover.** It now includes the dock, the revenue page, reports and the demo data module, and asserts the null gates exist, not just a token.
6. Two error sites still showed a bare `(401)` for guard denials; both now surface the reason.

### One honest weakness that remains

The reports guard asserts that `revenue30d === null` and `netPL === null` appear in the file. The reviewer showed that reverting only the computation, while leaving the render ternaries, would still match, so the assertion is weaker than its comment. The code is correct today; the test should be tightened to `revenue30d = revenueLive ?` in a follow-up.

### Not fixed, recorded

- Reaction and agent-profile reads still use the anon client and fail under the lockdown, so reaction counts do not render. Reported as P2 by the reviewer.
- The client never reuses an idempotency key on retry, so the unique index cannot fire from the UI yet.
- Realtime is RLS-dead while the badge still reports connected.
- Tenant scoping and channel-existence checks on the service-role routes are not enforced; not exploitable with owner-only credentials and a single tenant, but they should be.


---

## 12. Canonical cockpit migration audit (Phase 2)

### 12.1 Live state

| Item | Value |
|---|---|
| Live commit | `41d183a0`, 2026-10-05, "P06 M5C: Parallax OS pages carry their own title and manifest (#46)" |
| Deployment path | `/Users/admin/cockpit-releases/41d183a0` (pinned copy, its own git checkout) |
| LaunchAgent | `com.command-center`: `cd /Users/admin/cockpit-releases/41d183a0 && ... next start -H 127.0.0.1 -p 3000`, `NEXT_DIST_DIR=.next-cc`, `CC_EXECUTION_EVENTS=1`, KeepAlive, restart on exit |
| Build | Next 16.2.4, build id `O_2PPHl3Wjiq0d_uIj5ZD` |
| Tunnel | `com.command-center-tunnel`: `cloudflared tunnel run command-center`, tunnel `2bbb32b5-e281-4677-a4f7-7435dca76830` |
| Access | Cloudflare Access in front of `command.parallaxvinc.com`, 302 to `calm-firefly-c94b.cloudflareaccess.com`, `CF_AppSession` cookie |

Tunnel ingress, which is more than the cockpit:

| Host / path | Target | Purpose |
|---|---|---|
| `command.parallaxvinc.com/webhooks/*` | 9876 | webhook listener |
| `command.parallaxvinc.com/*` | 3000 | cockpit |
| `claude.parallaxvinc.com/*` | 9999 | Claude Max bridge that Vercel calls (needs the Mac subscription) |
| `openclaw.parallaxvinc.com/*` | 24511 | OpenClaw gateway, bearer auth, lets Vercel dispatch into agents |

So Vercel and the iMac are already coupled: the marketing site depends on `claude.parallaxvinc.com` and `openclaw.parallaxvinc.com`. Any tunnel change affects the public site too.

### 12.2 Pinned release versus main

- Divergence: 37 commits only on the release side, 60 only on main. **458 files changed**, +11,990 / -27,999.
- Changed areas: 198 files under `src/app`, 133 under `src/lib`, 21 components, 8 migrations, plus proxy and test changes.
- The release has **no trusted-device routes** (`api/command-center/auth/device/*` count: 0), **no mobile shell** (`po-menu-btn` count: 0), and **no Command Center manifest**. It authenticates with a Firebase `__session` and `/command-login`.
- `public/sw.js` is identical between release and main, so service-worker caching behaviour does not change. The manifest does: main serves `/manifest-command-center.webmanifest` with `id` and `scope` `/command-center`.
- Next 16.2.4 (release) versus 16.4.1 (main), with the dependency and middleware changes that implies.

### 12.3 Dependency map

| Dependency | Where it lives | Migration note |
|---|---|---|
| Supabase (messages, channels, device trust) | Shared project, service role in env | New middleware and chat routes expect `cc_trusted_devices`, `cc_device_enrollment_codes` and the idempotency column. Confirm before deploy; a missing table turns every login into a 503 or a bootstrap loop. |
| Firebase session | `__session` cookie, 12h guard window | Existing tunnel sessions keep working because the guard still accepts the session alone; device trust adds the PIN layer on top. |
| OpenClaw gateway | `127.0.0.1:24511`, bearer token in `openclaw.json` | Untouched by a cockpit release. |
| Claude Max bridge | `127.0.0.1:3456`, tunnel host `claude.` | Untouched. |
| Builds inventory | `~/.openclaw/workspace/builds` | Only the iMac can read it. |
| Env vars | LaunchAgent sets only `CC_EXECUTION_EVENTS`; the rest come from the shell/plist environment or `.env` | A new release must keep the same env contract; the safe-area and device features need `CC_PIN`, `CC_UNLOCK_SIGNING_SECRET`, `CC_BOOTSTRAP_SECRET`, `PARALLAX_OWNER_UID`. |

### 12.4 Installed PWA and the canonical domain

The release has no Command Center manifest, so a home-screen install of `command.parallaxvinc.com` inherits the root `manifest.json`: name "Parallax", `start_url: "/"`, `display: standalone`, and no scope narrower than the origin, which means the root marketing manifest governs the installed cockpit. Main fixes this with `id` and `scope` `/command-center`.

Migration risks specific to the installed app:

- **Origin trust is per host.** `cc_device` and `cc_unlock` cookies set on `ramiche-site.vercel.app` do not transfer to `command.parallaxvinc.com`. Moving origins means re-enrolling the phone once, by bootstrap token or approval code.
- **Manifest identity change.** An installed app whose `start_url` or `scope` changes can open at a different route or be treated as a second install, because the manifest `id` changed from implicit `/` to `/command-center`.
- **Service worker is unchanged**, so no stale-asset break is expected, but the install prompt and icon set will differ after the upgrade.
- **Access session** (`CF_AppSession`) is independent of app auth, so a Cloudflare policy change would lock the door before the app is even reached.

### 12.5 Rollback strategy (tested design, not executed)

The release directory pattern makes rollback cheap and is the reason not to build in place:

1. Keep `41d183a0` untouched. A new release goes to `/Users/admin/cockpit-releases/<new-sha>`.
2. Repoint only the `cd` path inside `com.command-center.plist` (a one-line change), then `launchctl kickstart -k`.
3. Rollback is the reverse: point back at `41d183a0`, kickstart, confirm port 3000 and a 200 on `/command-login`.
4. The Cloudflare tunnel, DNS and Access are not touched at all, so rollback cannot break the public site.

Pre-conditions to verify before any migration: the device tables exist, `CC_PIN` and the two signing/bootstrap secrets are present in the LaunchAgent environment, and a second device can complete bootstrap plus PIN on a preview port before the tunnel is repointed.

### 12.6 Migration plan (not executed, requires authorization)

1. Build the current main tree next to the pinned release and run it on port 3001, bound to 127.0.0.1 only.
2. Give it the same env contract, plus the device secrets. Do not touch the tunnel.
3. From the iMac itself, exercise `/command-login`, `/command-center`, `/command-center/unlock`, `/command-center/chat` and one API route on 3001. Confirm no 503 and no bootstrap loop.
4. Verify the three device tables and the chat idempotency column exist; if the column is absent, the route already falls back, so chat still works.
5. Only then repoint the LaunchAgent and kickstart. Expected downtime is one restart, under ten seconds.
6. Immediately run the smoke list in section 12.7, then re-enroll the phone if it demands it.
7. If anything fails, repoint to `41d183a0` and kickstart. Nothing else to undo.

### 12.7 Production smoke plan

- `GET /command-login` 200, `GET /command-center` 307 to login when unauthenticated.
- Cloudflare Access challenge appears from a non-allowlisted network.
- After auth: dashboard, agents, chat history load, finance shows measured or unavailable, builds show a real source label.
- One chat send persists across reload.
- Device trust survives a browser restart; lock returns to PIN.
- A second device needs an approval code, not the bootstrap token.

### 12.8 Current blockers

- No owner authorization to repoint the LaunchAgent or touch device secrets.
- The installed PWA origin is still unconfirmed.
- `command.parallaxvinc.com` is behind Access, so end-to-end tests need an Access service token or an allowlisted network; neither exists on this machine.


---

## 13. CC-RECOVERY-03 status

Operation target is `command.parallaxvinc.com`. Nothing below was merged, deployed, or applied to the live cockpit.

### 13.1 Approved fixes verified

| PR | Head | State |
|---|---|---|
| #92 | `ce071f71` | APPROVE, CI green, mergeable against main |
| #93 | `97377128` | APPROVE, CI green, mergeable |
| #91 | `7144acbb` | reviewed, not merged, needs one assertion widening after #93 |
| #94 | `937eecde` | this document |

### 13.2 The two expected failures

Both are explicit `it.fails` contracts, not hidden red tests.

1. **`POST /api/command-center/chat` has no client idempotency key.** Legitimate known exclusion: the message-write path is idempotent once the migration is applied, but the agent-relay route is a separate concern and is not covered by that index.
2. **No resume reconciliation for iOS bfcache.** This was an **unresolved mobile defect**, not an exclusion. A backgrounded PWA could show a stale conversation until a manual reload. Implemented in the candidate: a resume counter bumped on `pageshow` and `visibilitychange` re-runs the history effect, and the contract test is promoted from `it.fails` to a real assertion.

### 13.3 Phase 3 — fleet model authority (draft PR #95)

- `src/lib/fleet/model-registry.ts` reads the real `openclaw.json`, validates changes against the provider catalogue, and writes with an exclusive lock, timestamped backup, atomic rename and read-back. Success is only reported when the disk matches.
- Secrets, tokens and base URLs never leave the module; a test asserts the fixture API key never appears in the payload.
- `GET`/`POST /api/command-center/fleet/models` are owner-gated. GET returns 503 `source=unavailable` where the registry is absent (Vercel), never an empty list.
- Reachability is reported as `unverified`, never guessed.
- 16 unit tests. No live configuration was read or written.

Not wired: the Settings page still posts to the old `directory.json` route. Wiring should land with the model-picker visual review.

### 13.4 Phase 4 — YOLO builds truth (partial)

Implemented in the candidate: one explicit load state (`loading`, `error`, `ready`), a single empty message, the error reason surfaced instead of an empty grid, and the header relabelled `N AGENTS WITH BUILDS` because the number is derived from builds, not from the fleet.

Still missing: source identity, `observedAt`, freshness and a verified-empty receipt from the API. The route still reads the filesystem, so Vercel can only ever return zero. That needs the iMac source contract before it can be honest on both origins.

### 13.5 Phase 5 — mobile candidate

Branch `candidate/cc-recovery-03`, head `fc7cbeec`, built on #92 + #93 + #91.

- Sanctuary clears the HUD: `.sanc` top equals HUD bottom at 320/390/430, plus 38px when the ticker is mounted.
- YOLO chips stack label and lane; measured zero overlaps at 320/390/1920.
- Desktop key hint hidden on coarse pointers.
- iOS resume reconciliation.
- One honest YOLO load state.

Suite: 1042 passed, 1 expected fail, 4 skipped. `tsc` and build clean.

### 13.6 Phase 6 — release readiness

- **Candidate:** `candidate/cc-recovery-03` at `fc7cbeec1699a30b4c1a66bf1a4367502d28456d` (integration of #92, #93, #91 plus Phase 5 fixes). The #91 assertion widening is committed on this branch.
- **Deployment procedure and rollback:** section 12.6 and 12.5. Release directories plus a one-line LaunchAgent repoint; rollback is the reverse.
- **Smoke plan:** section 12.7.
- **Remaining blockers:**
  - Device and chat tables must be confirmed in the production database before the new middleware can run without a bootstrap loop.
  - The installed PWA origin is unconfirmed.
  - Gates 3 and 4 are not production-complete (no UI wiring; no source identity or freshness).
  - `command.parallaxvinc.com` is behind Access, so end-to-end tests need an Access service token or an allowlisted network.
  - No physical iPhone run.
- **Smallest authorization:** approve merging #92 then #93, then #91 with the assertion change, and approve the candidate branch for a preview build on the iMac on port 3001 (no tunnel change). Deploying the cockpit itself remains a separate, later approval.


---

## 14. CC-RECOVERY-04 merge and preview prerequisites

### 14.1 Merges

| PR | Approved head | Merge commit | Post-merge main CI |
|---|---|---|---|
| #92 finance truth | `ce071f71` | `e0accc199852bc683cc78e3241ccc461f47ca0a3` | lint-build, test, security pass |
| #93 chat recovery | `97377128` | `8cafa0abd4cb43884752a7be98d4d6c8c35040dc` | lint-build, test, security pass |

Main is `8cafa0abd4cb43884752a7be98d4d6c8c35040dc`. #92 was merged only after its exact head, main, clean mergeability and CI were re-verified. #93 merged the same way after main advanced.

**The candidate SHA `fc7cbeec` is no longer the correct integration tree.** It was built on top of #91, which is not yet in main. After #91 lands, the candidate must be rebuilt from the new main and the two Phase 5 commits reapplied.

### 14.2 Production database prerequisites (read-only probe)

Probed through the service role against `qkbkfsjkysdsfmhgfdoc`, no writes.

| Object | Result |
|---|---|
| `cc_trusted_devices` | 200, columns include `id`, `secret_hash`, `owner_uid`, `expires_at`, `revoked_at`, `locked_until`, `failed_pin_attempts` |
| `messages` | 200, columns include `status`, `pinned`, `is_pinned`, `sender_user_id`, `thread_parent_id`, `tenant_id`, `metadata` |
| `channels`, `channel_members`, `agent_profiles`, `message_reactions` | 200 |
| `cc_device_enrollment_codes` | **403 permission denied for the service role** |
| `cc_bootstrap_state` | **403 permission denied for the service role** |
| `messages.client_message_id` | absent (prepared migration not applied) |
| `messages.relay_claimed` | absent (same migration) |

Two consequences:

1. **First-device bootstrap and new-device approval are broken for the service role.** The owner's existing device still unlocks, because `cc_trusted_devices` is readable, but adding a device or re-enrolling would fail. The least-privilege migration appears to have granted only the tables day-to-day use needs. This is a release blocker for a fresh install and for recovering a lost device.
2. Chat send persists and the agent relay still dispatches, because the relay claim **fails open** when `relay_claimed` is missing. What is lost is duplicate-dispatch protection, exactly as #93 documents. Applying the migration turns it on; it also removes the PGRST204 fallback round trip.

### 14.3 Preview environment requirements

The pinned release's `.env.local` provides Firebase, Supabase, PIN, bridge, gateway, SMTP and Sentry values. The new main additionally needs:

| Variable | Present on the cockpit host | Present in Vercel production |
|---|---|---|
| `PARALLAX_OWNER_UID` | no | yes |
| `CC_UNLOCK_SIGNING_SECRET` | no | yes |
| `CC_BOOTSTRAP_SECRET` | no | yes |

A preview started without them fails closed with 503 (owner not configured), which is the correct behaviour but means the preview cannot demonstrate authenticated flows until they are supplied.

### 14.4 Isolation findings

- Port 3000 is held by pid 1834 (`com.command-center`), plist hash `d522cfc4dca5`. Port 3001 is free.
- The only boot hook is Sentry (`src/instrumentation.ts`). No schedulers, workers or polling loops start with the server.
- `vercel.json` crons are a Vercel platform feature and do not run under `next start`.
- Telegram and webhook code is inbound only; nothing polls.
- Execution telemetry is off unless `CC_EXECUTION_EVENTS` is set.
- Agent relay dispatch is opt-in via `OPENCLAW_CHAT_PRIMARY=1`; the preview must leave it unset.
- The only code that writes fleet configuration is the new owner-gated fleet route; the preview must not call its POST.

### 14.5 Preview auth blocker

There is no owner session available to this machine, and minting a device cookie requires a row in the production `cc_trusted_devices` table, which is a production database write and is not authorized. Authenticated preview acceptance therefore needs one of:

- the owner opening the preview over an SSH tunnel and signing in, or
- explicit authorization for one synthetic device row, created and revoked by label, or
- a temporary Access service token.

Unauthenticated preview checks (boot, login page, redirects, API denial with reason, absence of 503) can proceed without any of these.
