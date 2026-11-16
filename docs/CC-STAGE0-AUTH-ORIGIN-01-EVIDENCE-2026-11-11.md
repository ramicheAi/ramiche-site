# CC-STAGE0-AUTH-ORIGIN-01 — production-origin and Access evidence

**Date:** 2026-11-11
**Scope:** read-only continuation of draft PR #76 / `docs/CC-STAGE-0-EVIDENCE-CLOSURE-2026-11-11.md`.
**Mission baseline:** PR #76 head `f1ace06965f70185013e6c4e926435a169f7aba4` (verified against `gh pr view 76` at mission start — matched exactly, not stale).
**Method:** read-only SSH to the iMac origin (`ssh imac`, Tailscale), read-only `git`/`ps`/`lsof`/`launchctl`/`cat` on non-secret files, and safe unauthenticated HTTPS probes of the three public hostnames. No file was written, no process was restarted, no credential/config/DNS/Access/dependency change was made.

No merge, deploy, runtime implementation, policy change, database write, migration, credential change, or production data mutation occurred.

## 0. Correction to the existing ledger

**S0-E06 (existing ledger) described the wrong directory.** `/Users/admin/ramiche-site` (branch `simplify/cc-retire-unused`, HEAD `cabe7180e7ecd392707134c1c6dc4bca519cee4f`, dirty) is Ramon's **dev checkout**. It is not, and was never, the deployed origin. The LaunchAgent that actually serves `127.0.0.1:3000` (`com.command-center.plist`) hardcodes a different working directory:

```
cd /Users/admin/cockpit-releases/41d183a0 && ...
```

So the "the checkout is dirty, so that commit cannot establish the exact deployed artifact" blocker in the existing ledger is **resolved, not blocked** — it was looking at the wrong tree. See S0-E19 below.

## 1. Source-backed evidence ledger (continuation, S0-E19+)

| ID | Classification | Finding | Source and read-only method | Decision impact |
|---|---|---|---|---|
| S0-E19 | Observed | The deployed origin process (PID 2237, `next-server (v16.2.4)`, started `Thu Oct 29 11:19:02 2026`, uptime ~13d as of 2026-11-11) runs with `cwd=/Users/admin/cockpit-releases/41d183a0`, **not** `/Users/admin/ramiche-site`. | `ssh imac "ps -p 2237 -o pid,lstart,etime,command"` + `lsof -p 2237 \| grep cwd`. | The dirty dev checkout is irrelevant to artifact integrity. The deployed tree must be fingerprinted at `cockpit-releases/41d183a0`. |
| S0-E20 | Observed | `/Users/admin/cockpit-releases/41d183a0` is a **clean**, detached-HEAD Git checkout at `41d183a018e5987eb390a6dc307d3255d428d374` ("P06 M5C: Parallax OS pages carry their own title and manifest (#46)"), `git status` = clean. | `ssh imac "cd .../41d183a0 && git log -1 --format='%H %ci %s'; git status"`. | The exact deployed revision **is** reconstructible today, without touching the running service: `git worktree add`/`git clone` + checkout `41d183a0...` + `npm ci` + `NODE_ENV=production npx next build`. Task 3 is answered: yes, reproducible. |
| S0-E21 | Observed | `41d183a018e5987eb390a6dc307d3255d428d374` is **not** an ancestor of `origin/main` and **not** an ancestor of the current dev HEAD `cabe7180...`. It lives only on 11 `origin/p06/*` branches (e.g. `p06/m6-registry-truth`, `p06/overnight-product-sprint`). It was never merged to `main`. | `git merge-base --is-ancestor 41d183a0... origin/main` (fails) and `git branch -r --contains 41d183a0...`. | Production has been running an **unmerged branch artifact** for 5+ weeks. There is no main-line commit that currently reproduces what's live. This is the real deployment-integrity gap — not "the checkout is dirty." |
| S0-E22 | Observed | `/Users/admin/cockpit-releases/` holds 12 prior release snapshots (`4f446690` … `41d183a0`), each a clean detached-HEAD checkout, dated 2026-09-28 through 2026-10-05 — the last deploy is **36 days old** as of 2026-11-11. No `current`/`latest` symlink exists; promotion is done by hand-editing the absolute path inside `com.command-center.plist` (confirmed: the plist's own mtime, Oct 5 11:04:46, matches the `41d183a0` BUILD_ID mtime to the minute) and `launchctl kickstart`. 5 prior `.plist.bak.*` snapshots show the same manual pattern going back to 2026-06-17. | `ssh imac "ls -la .../cockpit-releases; stat -f '%Sm' .../com.command-center.plist; ls .../Library/LaunchAgents"`. | There is an informal clean-release convention already in place (one Git-pinned directory per deploy). It just has no symlink indirection, no rollback script, and no receipt. Task 4's spec (§4 below) formalizes exactly this existing pattern rather than inventing a new one. |
| S0-E23 | Observed | The deployed `middleware.ts` (at `41d183a0`) imports `requireOwnerIdentity` from `src/lib/server/owner-identity.ts` and gates `/`, `/command-login`, `/command-center*`, `/api/command-center/*`, and `/status.json` behind it. That file implements a fail-closed, timing-safe Firebase-session + exact-owner-UID check and explicitly documents that it rejects "PINs," hostname, and tailnet reachability as identity. | Direct read of `.../41d183a0/src/lib/server/owner-identity.ts` and `middleware.ts` over SSH (code only, no secret values). | Production currently has a **real app-level identity boundary**, not merely "a client-held shared PIN," as PR #76's established evidence summarized it. This changes the Stage 1 starting point: there is something to build on, not a blank app layer. |
| S0-E24 | Observed | `src/lib/server/owner-identity.ts` and the `/command-login` page do **not exist anywhere** in `origin/main`'s history (`git log --all --diff-filter=D` on that path: no hits — it was never added to `main`'s line) and are **absent** from the current dev checkout `/Users/admin/ramiche-site` at `cabe7180...` (verified directly on the iMac, byte-identical to this session's local clone of the same branch). | `git show origin/main:src/lib/server/owner-identity.ts` (missing); `ssh imac "find /Users/admin/ramiche-site/src -iname '*owner-identity*'"` (empty); `diff` of both checkouts' `middleware.ts` = identical. | The owner-identity boundary is **not a regression on `main`** — it only ever existed on the unmerged `p06/*` line. The active dev branch (`simplify/cc-retire-unused`) was never going to have it, and currently relies solely on a host-string allowlist (`fwdHost.startsWith("command.")` etc.) with no app-level identity check at all, trusting Cloudflare Access + tunnel routing entirely for `/command-center*`. |
| S0-E25 | Observed (live) | Unauthenticated `GET /status.json` on the real loopback origin returns `{"ok":false,"error":"denied","reason":"missing_session"}` — the exact `denialResponse()` path in `owner-identity.ts`, confirmed at runtime, not just in source. | `ssh imac "curl -s -H 'Host: command.parallaxvinc.com' http://127.0.0.1:3000/status.json"`. | The identity boundary found in S0-E23 is live and enforcing right now, independent of Cloudflare Access. |
| S0-E26 | Observed | All three public hostnames (`command.`, `claude.`, `openclaw.parallaxvinc.com`) return `302` to `calm-firefly-c94b.cloudflareaccess.com` with distinct `aud` values per app, and the webhook path `command.parallaxvinc.com/webhooks/*` is gated by the **same** whole-hostname Access app (no path-scoped bypass observed). | Safe unauthenticated `curl -I` against each hostname and against `/webhooks/test-probe-readonly`, 2026-11-11. | Confirms S0-E01/S0-E02 and extends them: no path-based Access bypass exists for the known webhook route. (Operational note, not a vulnerability: if the webhook sender can't complete an interactive Access login, it needs a Cloudflare **service token**, which this investigation could not confirm exists — see §2.) |
| S0-E27 | Observed | No Cloudflare API token is present on either machine: no `*CLOUDFLARE*`/`CF_API_TOKEN`-named env var on the iMac or this MacBook, no matching macOS Keychain generic-password item, no token string in the repo's `.env*` files. `cert.pem`/the tunnel credentials JSON under `~/.cloudflared/` are tunnel-registration material only, not an Access/Zone API token. | `env \| grep -i cloudflare` (both hosts, empty), `security find-generic-password -s cloudflare` (not found), `grep -lr CLOUDFLARE_API .env*` (empty). | **S0-E10's blocker is confirmed real and unresolved from this machine.** Cloudflare Access policy ordering, session duration, IdPs, device posture, and service-token rules require either (a) a scoped, read-only Cloudflare API token (Access: Read) added to the iMac's env for one inspection pass, or (b) Ramon's own authenticated dashboard session. Neither was available to this investigation. |
| S0-E28 | Observed | `npm audit` on the current checkout (same `package.json` lineage as the deployed release's dependency tree) reports **2 critical, 22 high, 34 moderate, 4 low** (62 total). Critical: `next` (critical, fix available, non-major) and `@sentry/nextjs` → `@sentry/node`/`@sentry/bundler-plugin-core` (critical, fix available, non-major). | `npm audit --json`, parsed locally, 2026-11-11. No `npm audit fix` or any dependency change was run. | See §5 for the full triage and exploitability read relevant to the auth/request path specifically. |

## 2. Cloudflare Access policy and identity-claim evidence matrix

| Item | Status | Evidence | What's missing |
|---|---|---|---|
| Access perimeter present | **Confirmed** | S0-E01, S0-E26 | — |
| Audience / issuer / JWKS | **Confirmed** (3 apps, distinct `aud`) | S0-E02, S0-E03, S0-E26 | — |
| Policy ordering / include-exclude rules | **Blocked** | — | Cloudflare API token (Access:Read) or dashboard session (S0-E27) |
| Session duration | **Blocked** | — | same |
| Identity providers enabled | **Blocked** | — | same |
| Device posture rules | **Blocked** | — | same |
| Service-token rules (relevant to `/webhooks/*`, S0-E26) | **Blocked** | — | same |
| Path-level bypass rules | **Negative-checked only** | S0-E26: webhook path is not bypassed; no other path tested (avoiding intrusive scanning of unlisted routes) | Dashboard/API confirmation that *no* bypass rule exists anywhere in the app, not just on the one path tested |
| Authenticated human JWT claim shape (`iss`/`sub`/`aud`/email/groups) | **Blocked** | — | One redacting diagnostic capture of a real authenticated request's `Cf-Access-Jwt-Assertion` header, claim *names* and *shapes* only, never raw values (per mission restriction) |

**This matrix is unchanged in substance from the existing ledger's S0-E10/S0-E13 blockers.** This investigation could not obtain Cloudflare dashboard or API credentials from either machine, and did not ask for or receive any. Closing this requires one of:
1. Ramon issues a **scoped, read-only** Cloudflare API token (Zone/Account → Access: Read only, no Edit scopes) for a single inspection pass, revoked afterward; or
2. Ramon takes read-only screenshots of Access → Applications → Policies for the `command.`/`claude.`/`openclaw.` apps; or
3. Ramon performs one authenticated login himself while this investigation captures the resulting `Cf-Access-Jwt-Assertion` claim *names* only (via a disposable, pre-approved logging point that is removed immediately after, never persisted).

## 3. Threat-model delta (vs. the existing ledger)

1. **Unmerged-branch production risk (new, S0-E21).** The live artifact traces to a PR branch that was never merged to `main`. Any future "redeploy from main" action would silently **remove** `owner-identity.ts`'s app-level identity check (S0-E24), since `main` never had it — a regression that would look like an improvement (newer code) while actually deleting a real auth boundary. **Any Stage 1 implementation must treat `main`'s current, PIN/host-trust-only state as the thing being upgraded, and must not assume parity with what's live today.**
2. **Access scope breadth unknown (existing, re-confirmed blocked).** Without policy visibility, it's unverified whether Access allows device posture bypass, a stale/over-broad IdP rule, or a forgotten service token with standing access. Treat this as unverified, not as absent.
3. **Webhook route has no confirmed independent auth (S0-E26).** `/webhooks/*` is Access-gated end-to-end today (good, confirms no path bypass), but if a real external webhook sender (not a human) needs to reach it, either a Cloudflare service token is configured (unverified, blocked per §2) or the route is currently unreachable by its intended caller. This is a functional question for Ramon, not a new vulnerability, but it affects Stage 1's assumption that "the webhook path is exercised."
4. **Deployment process has no integrity check (S0-E22).** Promotion is a hand-edit of an absolute path in a `launchd` plist plus a manual `kickstart`. Nothing verifies the new release directory's commit is reviewed, tested, or even intended for production before the swap. No signature, no receipt, no rollback command — only `.plist.bak.*` snapshots created ad hoc.
5. **Dependency surface on the auth/request path (S0-E28).** `next` itself is flagged critical; since `next` **is** the request-routing and middleware runtime that `owner-identity.ts` and the Access-adjacent middleware run inside, a `next`-specific critical CVE is in-path for every request, authenticated or not. See §5 for which CVE class applies.

## 4. Clean-build / immutable-release / rollback / deployment-receipt specification

This formalizes the pattern already implied by `cockpit-releases/*` (S0-E22) rather than inventing a new mechanism — the closest-to-zero-risk path, since it extends something already running correctly for 12 prior releases.

**Build:**
- `git worktree add /Users/admin/cockpit-releases/<short-sha> <ref>` from a reviewed, named ref (a tag or a merged `main` commit — never a bare branch tip) — never reuse a directory name.
- `npm ci` (not `npm install`) inside the new worktree, pinned by `package-lock.json`.
- `NODE_ENV=production npx next build` with `NEXT_DIST_DIR=.next-cc`.
- Compute and store `sha256` of the worktree's committed tree (`git rev-parse HEAD`) plus a build fingerprint (`.next-cc/BUILD_ID`) into a **deployment receipt** (see below) before the release is eligible for promotion.

**Immutable release:**
- The worktree directory is never edited in place post-build. Any fix is a new `<short-sha>` directory.
- A single `current` symlink (`/Users/admin/cockpit-releases/current -> <short-sha>`) becomes the one thing that changes at promotion time, replacing the current hand-edited absolute path inside `com.command-center.plist`. The plist's `cd` target becomes `cd /Users/admin/cockpit-releases/current`.

**Deployment receipt (new artifact, not currently present):**
- A small JSON file written at build time and copied alongside the symlink target, e.g. `cockpit-releases/<short-sha>/DEPLOY_RECEIPT.json`: `{ "git_sha": "...", "git_ref": "...", "built_at": "...", "built_by": "...", "build_id": "...", "npm_audit_critical": N, "npm_audit_high": N }`. Exposed read-only (no secrets) at `GET /api/deploy-receipt` or folded into the existing `/api/health` response, so "what's actually running" is answerable with one `curl` instead of an SSH session into `ps`/`lsof`, closing exactly the gap this investigation had to work around.

**Rollback:**
- `ln -sfn /Users/admin/cockpit-releases/<previous-short-sha> /Users/admin/cockpit-releases/current && launchctl kickstart -k gui/$(id -u)/com.command-center`. No rebuild, no checkout mutation — the previous worktree is untouched and still present on disk (matches the existing retention of 12 prior releases).
- Rollback target is always a receipt-bearing, previously-promoted release — never an arbitrary commit.

**Promotion gate (process, not code):** a release is only eligible to become `current` if (a) its ref is on `main` or an explicitly founder-approved tag, (b) `npm audit --audit-level=critical` is clean or has a logged, dated exception, and (c) the receipt is written before the symlink flips. This directly prevents a repeat of S0-E21 (an unmerged branch silently becoming "production" with no record of why).

This is a **specification only** — implementing it (changing the plist, adding the symlink, adding the receipt endpoint) is Stage 1+ work requiring separate founder approval, per mission restrictions.

## 5. Security vulnerability triage (Task 10)

Full `npm audit` output: 2 critical, 22 high, 34 moderate, 4 low, all with `fixAvailable` (mostly non-major; two packages — `nodemailer`, `shadcn`/`zod`/`deepmerge`/`ts-morph` — only have a major-version fix available).

**The two critical findings, with exploitability read against the production request path:**

| Package | Severity | In request path? | Prerequisite to exploit | Remediation |
|---|---|---|---|---|
| `next` | critical | **Yes — directly.** `next` is the framework serving every request through the exact middleware this mission is auditing. | Depends on the specific advisory ID bundled in this audit run (not retrieved here — `npm audit` gives severity/package, not the CVE text, without `--json` advisory detail parsing this session did not do). **Action before Stage 1:** pull the advisory ID(s) via `npm audit --json | jq '.vulnerabilities.next.via'` offline and confirm whether the fixed version is a patch or a major bump; `next` is currently `v16.2.4` live (S0-E19/S0-E25) — confirm the installed dev-tree version matches and whether the fix is already >= the deployed version. | Non-major fix available per this audit run; apply only via a new reviewed release per §4, never by patching the live `cockpit-releases/41d183a0` directory in place. |
| `@sentry/nextjs` (via `@sentry/node`, `@sentry/bundler-plugin-core`) | critical | **Indirect — build/observability tooling, not the request-handling path itself**, but `@sentry/node` does run server-side at request time if Sentry server-side error capture is wired into the app (needs confirming against this app's `sentry.server.config.ts`, which exists per the `cockpit-releases/b046d55d` file listing in S0-E22's `find`). | If server-side Sentry capture is active, an attacker-influenced value reaching Sentry's capture path could matter; needs the specific advisory to say which capacity (build-plugin-only vs. runtime SDK) is critical. | Fix available, non-major. Same promotion-gated remediation path as above. |

**High-severity items with the clearest in-path relevance:** `body-parser`, `undici`, `ws`, `form-data` — all can sit on the HTTP/fetch path Next.js and any server-side `fetch` calls use; `js-yaml`, `node-forge`, `protobufjs` are more likely transitive/tooling. A full per-package request-path classification was not completed for all 22 — flagging this as unfinished rather than asserting it's done.

**No dependency was changed.** This is triage only, per mission restriction.

## 6. Stage 1 identity acceptance test matrix

Given S0-E23–S0-E25 (a real identity boundary exists today, on an unmerged branch, and `main`/current dev work has none), Stage 1's job is to design the Cloudflare-Access-JWT-based replacement *and* decide whether `requireOwnerIdentity`'s Firebase-session layer is retained as defense-in-depth or retired in favor of Access alone. Proposed acceptance tests (none implemented — design only):

| # | Test | Expected result |
|---|---|---|
| 1 | No `Cf-Access-Jwt-Assertion` header present | 401, generic denial body (no reason leaked to an unauthenticated caller beyond what S0-E25 already does) |
| 2 | Expired Access JWT | 401 |
| 3 | Wrong `aud` (token issued for a different Access app, e.g. `claude.` token presented to `command.`) | 401 |
| 4 | Wrong `iss` / unknown `kid` not in current JWKS | 401, and verifier must re-fetch JWKS on unknown `kid` before failing (key-rotation safety) |
| 5 | Valid JWT, subject not the configured owner principal | 403, same "not_owner"-class response as today's `requireOwnerIdentity` |
| 6 | Valid JWT, correct owner principal | 200, session established |
| 7 | Service-token-authenticated request (no human claims) presented to a human-only route | 401/403 — service tokens must never satisfy human identity, mirroring the existing `owner-identity.ts` comment that explicitly bans this |
| 8 | Replay of a previously valid, now-expired JWT | 401 |
| 9 | JWKS endpoint temporarily unreachable | Fail closed (503), never fail open — matching the existing `owner_not_configured` fail-closed pattern already in `owner-identity.ts` |
| 10 | Direct loopback/tunnel-bypass request (if one is ever found reachable) carrying no Access headers at all | Must deny identically to #1 — host trust alone must never substitute for the JWT check (this is the exact gap in the *current dev branch's* middleware per S0-E24) |

## 7. GO / NO-GO recommendation

**NO-GO for Stage 0 closure — same overall verdict as the existing ledger, but the remaining blocker set has shrunk and changed shape:**

**Resolved by this investigation (no longer blockers):**
- Immutable deployed revision now **is** established: `41d183a018e5987eb390a6dc307d3255d428d374`, clean tree, directly reconstructible (S0-E19, S0-E20).
- The "dirty checkout" framing in S0-E06 is superseded — the actual deployed tree was never dirty.
- A real app-level identity boundary was found to exist in production today (S0-E23–S0-E25), changing Stage 1 from "build identity from zero" to "decide what to do with the identity layer that unmerged branch work already built, now that it's 5 weeks stale and off the main line."

**Still blocking, unchanged in kind, confirmed unresolvable from either machine without Ramon:**
- Cloudflare Access policy export, session duration, IdP, device-posture, and service-token rules (§2) — needs a scoped API token or Ramon's dashboard session.
- Authenticated human JWT claim shape — needs one redacted, approved capture.
- Real-device mobile lifecycle acceptance (unchanged from S0-E13, out of this mission's scope but still a Stage-0-closure dependency per the existing ledger).

**New, not previously tracked:**
- The production artifact is on an unmerged branch 5+ weeks stale (S0-E21) — a founder decision is needed on whether to (a) merge the `p06/*` line that's actually live into `main` first (so "what's running" and "what's reviewable on `main`" are the same thing), or (b) treat it as throwaway and rebuild Stage 1 fresh off current `main`/dev work, accepting that today's live identity check disappears either way until Stage 1 replaces it.

**Smallest founder actions that unblock the rest:**
1. Decide (a) vs (b) above for the unmerged `p06/*` production line.
2. Provide a scoped, read-only Cloudflare API token (Access:Read) for one inspection pass, or take the policy screenshots directly, or do one supervised authenticated login for a redacted claim capture.
3. Separately authorize implementing §4's receipt/symlink mechanism, once (1) is decided — it's a small, low-risk change but is still outside this mission's read-only restriction.

---
*Compiled by Claude Code under mission CC-STAGE0-AUTH-ORIGIN-01. All SSH/curl evidence above is reproducible read-only from this MacBook; no state was changed on the iMac, in Cloudflare, in DNS, or in the repository's dependencies.*
