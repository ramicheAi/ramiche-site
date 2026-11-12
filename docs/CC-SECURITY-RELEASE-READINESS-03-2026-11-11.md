# CC-SECURITY-RELEASE-READINESS-03: release readiness (2026-11-11)

No secret values appear in this document. Nothing here was merged, deployed, rotated or restarted. Production
(`com.command-center`, pid 1063) was re-read and still runs from `/Users/admin/cockpit-releases/41d183a0`, untouched.

## 1. PR map

| PR | Purpose | Head | Base |
|---|---|---|---|
| #76 | Stage 0 architecture evidence (docs only, unchanged) | f1ace06 | main |
| #78 | Owner-boundary reconciliation | 23b6968d | main |
| #79 | next 16.4.1, @sentry/nextjs 10.75.2 only | 7220c098 | main |
| #80 | Remove BRIDGE_API_SECRET from the browser | e3a35aa3 | #78 |
| #81 | Telegram approver, prospector scheduler, preview sandbox, API inventory, cookie tests, this doc | see PR | #80 |
| branch `candidate/release-03` (no PR) | #81 + #79, integration build target | 20106afa | main |

## 2. Vulnerabilities

Fixed (PR #79, verified): GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r (next, critical) and
GHSA-mchm-gjx6-7h55 (@sentry/nextjs, critical). `npm audit` on the candidate: 0 critical. The `security` GitHub check
**passes on #79 (7220c098)** and **fails on #78 (23b6968d)**, so #78 must not merge ahead of #79.

Remaining, not touched (no unrelated upgrades per mission): 22 high (15 in production deps). All but nodemailer are
transitive. Nodemailer 8.0.7 is flagged (fix is a 10.x major): the advisories are CRLF in `List-*` header comments and
`jsonTransport`; neither is used (`leads/send` uses SMTP, sets no List headers, validates `to`). Defer with a ticket.
Suppression or `npm audit fix --force`: not used.

## 3. Deployed Firestore rules (read via the Firebase Rules API, read-only)

Deployed rules deny every read and write under `command-center/**` and default-deny everything else. An
unauthenticated REST read returned 403. The earlier "implied public Firestore" blocker is closed. Consequence
(inference, not tested): the bridge's credential-less Firestore REST calls cannot succeed. No production write was
attempted. Firebase console evidence not needed for this conclusion.

## 4. Secret exposure and rotation

The bridge secret literal was hardcoded in `command-center/legacy/page.tsx`. It is in git history and in any client
bundle built from `main`, so it is **exposed**. It is not the live Vercel value (status probe returned 401) but it is the
value in two iMac `.env.local` files, and the iMac launchd plist also passes a secret on argv. The `41d183a0` build output
does not contain the literal. Candidate build: header `x-bridge-secret` appears in 0 client chunks.
Rotation is **not done**; runbook, sequencing, rollback and verification are in `CC-BRIDGE-SECRET-ROTATION-2026-11-11.md`.
During this session one launchd argv secret was echoed once into tool output; treat that value as exposed and include it
in the same rotation.

## 5. Route and identity matrix

| Class | Routes | Identity | Enforced |
|---|---|---|---|
| Human, owner only | all `command-center/**` except machine list; `atlas/chat`; `bridge` GET/PATCH; `bridge/tasks|chat|crons`; `pipeline-tasks`; `test-supabase` | Firebase session cookie, human provider, exact `PARALLAX_OWNER_UID`, max age 12h, checkRevoked, CSRF on mutations | middleware AND handler (`ownerOnly`) |
| Machine | `chat/webhook`, `push`, `telegram/webhook`, `voice/call/webhook`, `prospector/cron`, `bridge` POST, `meet-results/cron` | own secret, timing-safe, fail closed | handler; exact-path bypass in middleware |
| Session flows | `auth/command-session`, `auth/session`, `stripe/connect`, power-challenge admin/export | ID token / session / admin credential | handler |
| Provider signature | `stripe/webhook` | Stripe signature | handler |
| Public by design | health, free-audit, studio-inquiry, stripe checkout/portal/agents-checkout, power-challenge/checkout, sentry-smoke (token no-op) | none | n/a |
| **Open finding (not changed)** | bff/athlete, bff/coach, bff/parent, meet-results, meet-schedule, notifications/send, power-challenge/registrations, push/send, push/subscribe, swimcloud | none | METTLE product decision needed |

`api-surface-classification.test.ts` fails if any route is unclassified. `push/send` is called by the apex-athlete coach
page, so locking it needs a METTLE auth design.

## 6. Integration preservation (fail-closed matrix on the iMac release env)

Presence only, from the `41d183a0` env files:

| Variable | Present | Effect under the candidate |
|---|---|---|
| PARALLAX_OWNER_UID, FIREBASE_SERVICE_ACCOUNT | yes | owner login works |
| OPENCLAW_GATEWAY_TOKEN | yes | chat/webhook keeps working (fallback token) |
| BRIDGE_API_SECRET | yes | bridge POST keeps working |
| TELEGRAM_WEBHOOK_SECRET | **no** | Telegram webhook returns 401 until set |
| TELEGRAM_APPROVER_IDS | **no** | approvals refused until set |
| VAPI_WEBHOOK_SECRET | **no** | Vapi end-of-call webhook returns 401 until set |
| CC_PUSH_SECRET | **no** | agent push returns 401 until set |
| OPENCLAW_CC_WEBHOOK_TOKEN | no | falls back to gateway token |
| PROSPECTOR_CRON_SECRET | **no** | scheduled prospecting returns 401 until set and the scheduler is repointed |
| CC_ALLOWED_ORIGINS | no | only needed if the owner uses a non-Host origin |

Vercel env presence is unverified: the Vercel API returned 403 to this session.

## 7. Real-server acceptance (candidate 20106afa, `next start`, localhost, test secrets)

tsc 0 errors; vitest 811 passed / 4 skipped; `next build` OK; `npm audit` 0 critical.
HTTP results: unauthenticated API 401, including with forged `Host`/`X-Forwarded-Host`; unauthenticated page 307 to an
absolute `https://<Host>/command-login?next=...` built from Host plus `x-forwarded-proto` (tunnel simulation); login page
200; bogus cookie 401; cross-site and origin-less cookie-bearing POST 403; `command-session` cross-site 403, bad token 401;
telegram/vapi/push/prospector-cron without secret 401; Telegram valid secret but unlisted user: no approval; cron GET 405;
bridge, preview, pipeline-tasks, test-supabase unauthenticated 401; METTLE session GET without cookie 401; health 200.

**Not proven on a real server:** an actual owner login against Firebase, and real expiry/revocation. The Firebase Admin
verifier was mocked in tests and absent in the server run. This needs the founder's real Firebase login on a staging
instance (the first manual step in section 9).

## 8. Genuinely inaccessible evidence

- Cloudflare Access policy, IdP, session duration and JWT claims: needs a Cloudflare API token or dashboard session.
- Cloudflare Tunnel ingress rules beyond the iMac-side config already read.
- Firebase console: Auth providers enabled, authorized domains, owner account existence.
- Vercel environment variables (403).
- #80 and #81 are stacked on non-main bases, so GitHub Actions did not run on them; the same checks ran locally on the
  candidate, and CI will run when #78 retargets main.

## 9. Founder-only actions (in order)

1. Approve merging #79 (dependency criticals), then #78, then #80, #81 (or merge the candidate branch as one PR).
2. Set on the iMac release env: `TELEGRAM_WEBHOOK_SECRET` (and re-register the Telegram webhook secret),
   `TELEGRAM_APPROVER_IDS`, `VAPI_WEBHOOK_SECRET`, `CC_PUSH_SECRET`, `PROSPECTOR_CRON_SECRET`; repoint the prospector scheduler
   to `POST /api/command-center/prospector/cron`.
3. Approve the bridge-secret rotation per its runbook.
4. Do one real owner login on a staged candidate; confirm logout and 12h expiry.
5. Supply Cloudflare Access evidence (or a read-only token).
6. Decide METTLE auth for the open findings (section 5).

## 10. Candidate release and rollback

Immutable build input: commit `20106afaf34a4f5bc3e6c0b8317dab2154eb92db`, lockfile sha256 prefix `b6966b8db996d225`,
Node 26.0.0, npm 11.12.1, Next BUILD_ID `FuXxFKNqq5F6BlQnCcsxn`. Not staged on the iMac, not promoted.
Promotion plan (needs approval): build from that SHA in a fresh directory `cockpit-releases/20106afa`, copy the two env
files, run the section 7 curl battery against a spare port, then repoint launchd. Rollback: repoint to
`cockpit-releases/41d183a0` (kept intact) and `launchctl kickstart -k`; no data migration is involved.

## 11. Verdicts

See the final report. Independent review disposition is appended below once complete.
