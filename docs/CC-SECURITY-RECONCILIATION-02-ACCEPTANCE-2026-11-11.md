# CC-SECURITY-RECONCILIATION-02 — PR #78 hardening and acceptance

Date: 2026-11-11. Base: `origin/main` @ `25f1f517`. Deployed iMac release `41d183a0` was read but never modified.
This document is the evidence companion to the code. Anything not verified is labelled UNVERIFIED.

## 1. What changed since the first pass (`28bbda4b`)

| Finding in the first pass | Fix |
|---|---|
| Only 4 of 65 routes checked identity in the handler | All 60 remaining human routes wrapped with `ownerOnly(...)`; `revenue` re-exports an already-guarded handler. Inventory test enforces it per file and per method. |
| `telegram/webhook` and `voice/call/webhook` were silently blocked by the new middleware (regression) | Added to an explicit exact-match `MACHINE_ROUTES` list; each verifies its own secret. |
| Telegram secret check **failed open** when `TELEGRAM_WEBHOOK_SECRET` was unset | Now fails closed, timing-safe. |
| Vapi end-of-call webhook had **no authentication** | Requires `VAPI_WEBHOOK_SECRET` (`x-vapi-secret` or Bearer); `voice-provider.ts` sends it as `assistant.server.secret`. |
| `chat/webhook` and `push` used `===` | Timing-safe, length-independent SHA-256 compare; fail closed when unset. `push` GET (an unauthenticated config disclosure) now needs the secret. |
| Login called the shared `/api/auth/session`, which mints a cookie for ANY Firebase identity, then only found out later it was not the owner | New `POST /api/auth/command-session`: owner configured, CSRF, ID token verified with revocation, human provider, exact uid, 12h cookie, minted cookie re-verified as owner before it is set. `/api/auth/session` is untouched, so METTLE is unaffected. |
| `?next=` went to `router.push` unvalidated (open redirect) | `safeCommandCenterNext`, used by middleware and the login page. |
| CSRF only caught `cross-site` and mismatched Origin; missing headers passed | Cookie-bearing mutations need `Sec-Fetch-Site: same-origin` or a matching Origin; missing, conflicting, `same-site`, `none` and `null` are rejected. Forwarding headers are never read. Also enforced inside every handler. |
| Middleware self-fetched `/api/auth/session` through `req.url` | Removed. Middleware runs on the Node runtime and verifies directly, as the deployed p06 line does. |

## 2. Real-server verification (production build, `next start`)

A unit test passed while the real server returned **500**: Next's middleware adapter rejects a relative `Location`. Found only by running the build. Fixed (absolute URL from `Host` + `x-forwarded-proto`, never `X-Forwarded-Host`). Observed on the final build, with a simulated tunnel `Host: command.parallaxvinc.com`:

- unauthenticated API: 401 JSON, with or without forged `Host` / `X-Forwarded-Host`
- unauthenticated page: 307 to `https://command.parallaxvinc.com/command-login?next=%2Fcommand-center%2Fleads`
- following redirects: exactly 1 hop, login page 200 (no loop); `/command-login` is not gated
- forged cookie: 401; cross-site POST with cookie: 403 `cross_site`; login POST with no origin headers: 403 `missing_origin`
- machine routes with no secret: 401 on every supported method (405 where the method is not exported)
- METTLE `/api/auth/session` GET: unchanged (401 `authenticated:false`); `/coach/x` still redirects to `/portal`
- zero `Invalid URL` errors in the server log after the fix

## 3. Authorization inventory (every `/api/command-center/*` route)

Caller type: HUMAN = the owner in a browser session. MACHINE = own secret, no session. Side effects come from a static scan and are indicative, not a proof; the per-route behavioural test is the proof of the authorization boundary.

| Route | Methods | Class | Side effects (static scan) |
|---|---|---|---|
| activity | GET | HUMAN | shell exec, DB read |
| agents | GET, POST | HUMAN | shell exec, fs write |
| app-builder | GET | HUMAN | shell exec |
| auth/pin | GET, POST | HUMAN | DB write |
| bambu | GET, POST | HUMAN | fs write |
| briefing/compose | GET, POST | HUMAN | local |
| calendar | GET | HUMAN | local |
| chat/action-status | GET, POST | HUMAN | DB write |
| chat/approve | GET, POST | HUMAN | local |
| chat/approve/stream | GET, POST | HUMAN | DB read |
| chat/decisions | GET | HUMAN | DB read |
| chat/health | GET | HUMAN | OpenClaw gateway, DB read |
| chat/mark-read | POST | HUMAN | DB write |
| chat/pin | POST | HUMAN | DB write |
| chat/pulse | GET | HUMAN | DB read |
| chat/reactions | POST | HUMAN | DB write |
| chat/regenerate-image | GET, POST | HUMAN | DB write |
| chat | GET, POST | HUMAN | DB write, shell exec |
| chat/search | GET | HUMAN | DB read |
| chat/stream | POST | HUMAN | DB write |
| chat/upload | POST | HUMAN | DB read |
| **chat/webhook** | POST | **MACHINE** (Bearer `OPENCLAW_CC_WEBHOOK_TOKEN` or `OPENCLAW_GATEWAY_TOKEN`) | DB write, gateway, Telegram |
| content | GET | HUMAN | local |
| crons | GET, POST | HUMAN | outbound fetch |
| docs | GET | HUMAN | local |
| export | GET | HUMAN | local |
| firestore-read | GET | HUMAN | local |
| firestore-sync | GET, POST | HUMAN | local |
| gate | GET, POST | HUMAN | DB write, outbound email |
| image-gen | GET, POST | HUMAN | DB read |
| jobs, jobs/[id] | GET, POST | HUMAN | DB write |
| leads/intel, leads/kit | POST | HUMAN | DB read |
| leads/send | POST | HUMAN | DB write, **outbound email** |
| memory | GET | HUMAN | read |
| meridian | GET | HUMAN | outbound fetch |
| oracle | POST | HUMAN | outbound fetch |
| pipeline/diagnose, leads, maintenance, proposals | GET/POST | HUMAN | DB write |
| pipeline/funnel, icp | GET | HUMAN | DB read |
| projects | GET | HUMAN | outbound fetch |
| prospector/daily, import | GET/POST | HUMAN | DB write |
| prospector/search | POST | HUMAN | local |
| **push** | GET, POST | **MACHINE** (`x-cc-push-secret` or Bearer `CC_PUSH_SECRET`) | DB write |
| revenue, stripe-revenue | GET | HUMAN | Stripe read (financial data) |
| roadmap | GET, POST | HUMAN | fs write |
| security | POST | HUMAN | shell exec (static commands only), info disclosure |
| settings | GET, POST | HUMAN | **gateway restart, cron enable/disable** |
| sse | GET | HUMAN | stream |
| tasks/notify | POST | HUMAN | outbound fetch |
| **telegram/webhook** | GET, POST | **MACHINE** (`X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`) | Telegram |
| voice/atlas, speak, transcribe | POST | HUMAN | model / TTS / fs |
| voice/call-list, metrics | GET | HUMAN | DB read |
| voice/call | POST | HUMAN | DB write, **places a phone call** |
| **voice/call/webhook** | POST | **MACHINE** (`VAPI_WEBHOOK_SECRET`) | DB write |
| wellness/verse | GET, POST | HUMAN | DB write |
| ws | GET, POST | HUMAN | outbound fetch |
| yolo-approve | POST | HUMAN | local |
| yolo-builds, yolo-builds/preview/[...path] | GET | HUMAN | local |

Counts: 69 route files. 60 wrapped with `ownerOnly`, 4 with an inline `requireCommandCenterOwner` (leads/send, security, settings, stripe-revenue), 1 re-export of a guarded handler (revenue), 4 MACHINE.

## 4. Proof that a middleware omission cannot expose anything

`src/app/api/command-center/authorization-inventory.test.ts` imports every route module and calls every exported method **without middleware**:

- no session, forged cookie, non-owner, anonymous/custom provider, forged identity/host headers, owner not configured: 401 / 401 / 403 / 401 / 401 / 503
- cross-site cookie-bearing mutation by the real owner: 403
- machine routes: missing, wrong, longer, prefix, empty-bearer, unset-secret, and cookie-instead-of-secret all 401 on every exported method
- mutation check: removing one `ownerOnly` wrapper makes 2 tests fail (static and behavioural); restored.

## 5. Dependency findings (`npm audit`, 2 critical / 22 high / 34 moderate / 4 low)

`next` and `@sentry/nextjs` are the two criticals. Versions: `main` = next 16.3.8, sentry 10.53.1, sharp 0.35.5. Deployed iMac release `41d183a0` = **next 16.2.4**, sentry 10.53.1, **sharp 0.34.5**.

| Advisory | Affects | Fixed in | Applicability here |
|---|---|---|---|
| GHSA-2464-fhr4-w9xw (critical, RCE, image optimization with SVG; upstream sharp memory bug, glibc Linux) | next 16.0.0–16.4.0 | next 16.4.1; or sharp >= 0.35.5 | iMac is Darwin, not glibc Linux: not applicable there. Vercel runs glibc Linux: applicable unless the lockfile resolves sharp >= 0.35.5 (local does: 0.35.5; the Vercel build resolution is UNVERIFIED). The iMac release has sharp 0.34.5. |
| GHSA-673q-mjm6-r5xr (critical, RCE, `use cache` returning typed arrays) | next 16.0.0–16.4.0 | next 16.4.1 | No `use cache` / `cacheComponents` in source (grep), on `main` or in the deployed release: not exploitable as written. Advisory says upgrade regardless. |
| GHSA-p3m5-59mp-jv5r / CVE-2026-94482 (high, DoS, Server Actions) | next 16.0.0–16.4.0 | next 16.4.1 | No `"use server"` in source: not applicable as written. |
| GHSA-mchm-gjx6-7h55 / CVE-2026-114139 (critical, middleware skipped on Sentry `tunnelRoute`) | @sentry/nextjs 10.0.0-alpha–10.75.1 | 10.75.2 | `tunnelRoute: "/monitoring"` IS set, but exploitation needs webpack (this build is Turbopack), a route under `/monitoring` or a root dynamic segment (none: `src/app` has no root `[param]`), and middleware as the only authorization. Command Center paths are not under `/monitoring`, and every handler now authorizes itself. Not exploitable here. |

The `security` CI job fails on `npm audit --audit-level=critical` on `main` itself (run on `25f1f517` failed) and on this PR. It was **not** suppressed or weakened. A bounded remediation PR is feasible: `npm install --dry-run next@16.4.1 @sentry/nextjs@10.75.2` resolves (non-major, adds 8, removes 48, changes 19 packages). `nodemailer` (high, direct, fix is a major bump) sits on the outbound-email path and needs its own review. Recommend: separate PR `next@16.4.1`, `@sentry/nextjs@>=10.75.2`, `npm audit fix` (non-force), then a nodemailer 10 upgrade reviewed on its own. Until that merges the `security` check stays red; if Ramon accepts that, the disposition is: "criticals not exploitable in this codebase as analysed above; remediation PR required before the next production promotion".

## 6. Runtime prerequisites by target (names only, no values read)

| Target | `PARALLAX_OWNER_UID` | `FIREBASE_SERVICE_ACCOUNT` | Machine secrets |
|---|---|---|---|
| iMac release `41d183a0` (`.env.production.local`) | present | present | `OPENCLAW_GATEWAY_TOKEN` present; `TELEGRAM_WEBHOOK_SECRET`, `VAPI_WEBHOOK_SECRET`, `CC_PUSH_SECRET`, `OPENCLAW_CC_WEBHOOK_TOKEN` **absent** |
| Vercel project `ramiche-site` | UNVERIFIED (env list returned 403) | UNVERIFIED | UNVERIFIED |

Consequences if a build of this PR were promoted to the iMac: Telegram approval buttons stop working until `TELEGRAM_WEBHOOK_SECRET` is set and `setWebhook` is re-registered with it (the old behaviour was fail-open); `push` stays closed until `CC_PUSH_SECRET` exists; Vapi capture stays closed until `VAPI_WEBHOOK_SECRET` exists. The launchd plist names none of these; the app reads `.env*` files in the release directory.
Optional hardening: set `CC_ALLOWED_ORIGINS=https://command.parallaxvinc.com`. The tunnel config on the iMac has no `httpHostHeader` override, so `Host` already equals the public host and the Origin check passes without it.

## 7. Topology audit (item 6)

- **Cloudflare Tunnel / iMac:** no self-fetch remains, so nothing depends on how `req.url` resolves behind the tunnel. The old design would have fetched `http://command.parallaxvinc.com/api/auth/session` out through the public hostname and Access. Tested live with a simulated tunnel `Host`.
- **Vercel Preview:** deployment protection would have 401'd the self-fetch; no self-fetch now. UNVERIFIED on the actual preview URL (Preview is behind Vercel's own protection; not bypassed).
- **Middleware runtime:** Node (`runtime: "nodejs"`), same as `41d183a0`. Next 16 logs a deprecation notice that `middleware` is renamed `proxy`; migration is a separate change.
- **METTLE:** still uses its own self-fetch (`firebaseSessionValid`) for `/coach` and `/athlete`; not part of this change.

## 8. Residual risks (honest list)

1. The client-side PIN (`auth/pin`, dev fallback) still exists and is not a security boundary; it is now behind the owner session.
2. Session cookie `SameSite=Lax`; state-changing GET handlers (if any exist) are protected by the owner session only, not CSRF. The inventory shows mutations are POST.
3. Cookie name `__session` is shared with METTLE; the owner cookie (12h) replaces a METTLE cookie in the same browser and vice versa.
4. Revocation relies on Firebase `checkRevoked`, which adds a network call per request.
5. `security` CI remains red for the dependency criticals until the remediation PR lands.
6. Static side-effect scan above is heuristic.
7. `ownerOnly` is applied by code convention plus the inventory test; a new route that is not wrapped fails that test, but only if the test runs.
8. Cloudflare Access policy, IdP, session duration, service tokens and the JWT claim shape remain UNVERIFIED (unchanged since PR #76: no Cloudflare API token on any machine).

## 9. Migration gates

1. Set `PARALLAX_OWNER_UID` (and `FIREBASE_SERVICE_ACCOUNT`) on every target that will serve Command Center; verify on Vercel, which this investigation could not.
2. Set `TELEGRAM_WEBHOOK_SECRET` and re-run `setWebhook` with the same `secret_token`, set `VAPI_WEBHOOK_SECRET`, `CC_PUSH_SECRET` and `OPENCLAW_CC_WEBHOOK_TOKEN` where those integrations are used, before promoting.
3. Land the dependency remediation PR (or record an accepted disposition).
4. Do not promote to the iMac with the hand-edited plist; use the immutable release procedure in PR #76.
5. Do not describe `main` as production-equivalent: production has p06 owner identity plus unmerged p06 features that this PR does not bring over.

## 10. Independent clean-context security review (commit `552b6ea7`)

A fresh reviewer that did not write the code attacked the owner boundary, route coverage, CSRF, redirects, machine routes and tests. It found no bypass of the gate itself and confirmed the inventory tests pass. It did raise two blocking issues outside `/api/command-center` plus several smaller ones. Disposition:

| ID | Finding | Disposition |
|---|---|---|
| B1 | `/api/atlas/chat` GET/POST unauthenticated, reads and writes the Command Center chat store (service-role key) | **Fixed**: owner-only at the handler; test added |
| B2 | `/api/bridge` GET/PATCH unauthenticated, read/write Command Center Firestore docs | **Fixed**: GET/PATCH owner-only; `bridge/tasks`, `bridge/chat`, `bridge/crons` owner-only on all methods; root POST stays secret-gated machine sync. **Not fixed, UNVERIFIED**: the Firestore REST calls carry no credentials, so live Firestore rules may allow public read/write on `command-center/*` whatever the app does. Rules are not in the repo. Needs a human check of the Firebase console. |
| N5 | 12h owner session not enforced (shared endpoint mints 30-day cookies) | **Fixed**: owner boundary rejects cookies older than 12h (`session_expired`) |
| N6 | Login CSRF on the shared `/api/auth/session` POST/DELETE | **Fixed**: same-origin evidence required; METTLE browser calls are same-origin |
| N10 | Test gaps | Partly fixed: any `route.*` extension discovered; routes outside `/api/command-center` covered; context forwarding tested. Still open: the matcher/runtime config is exercised only by the real-server run in section 2, not by a test. |
| N1 | Project data served from `public/projects/**` is already public | Open, accepted as not secret unless Ramon says otherwise |
| N2 | Agent-built HTML served same-origin by `yolo-builds/preview` | Open residual risk; recommend a sandbox origin or CSP `sandbox` |
| N3 | `prospector/daily` GET has side effects (not CSRF-covered, `SameSite=Lax`) | Open; make POST-only |
| N4 | Scheduled prospector call (if any) now gets 401 | Open; no scheduler found on the MacBook, iMac launchd jobs not checked |
| N7 | Missing/broken `FIREBASE_SERVICE_ACCOUNT` shows as `invalid_session`, not "not configured" | Open; present on the iMac release (name only) |
| N8 | Origin check depends on `Host` | Mitigated by `CC_ALLOWED_ORIGINS` (recommended); iMac tunnel config verified to have no host override |
| N9 | Telegram Approve button does not check who pressed it | Open; allowlist the owner Telegram user id |
| extra | `src/app/command-center/legacy/page.tsx` hardcodes the bridge secret (`x-bridge-secret`) in client code, so the `bridge/*` secret is effectively public | Open **blocker for the secret-gated bridge POST**; rotate `BRIDGE_API_SECRET` and remove it from the bundle (secret change is outside this task) |
