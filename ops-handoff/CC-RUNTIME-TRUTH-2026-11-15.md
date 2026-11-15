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
