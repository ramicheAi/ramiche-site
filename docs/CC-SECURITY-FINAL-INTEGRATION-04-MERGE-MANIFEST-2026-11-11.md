# CC-SECURITY-FINAL-INTEGRATION-04: merge manifest (2026-11-11)

No secret values appear here. Nothing was merged, deployed, rotated or restarted.

## Verdicts
**MERGE: GO** for the integrated tree `eb7998ad` into `main`, conditional on the merge method below.
**PRODUCTION: NO-GO.** Smallest actions that clear it: (1) one real owner login, logout, revocation and 12h expiry against real Firebase on a staged instance; (2) set the five missing iMac env vars and repoint the prospector scheduler. Rotation of the bridge secret is required before the old value is considered dead but does not block the swap.

## Inputs (rechecked at start; main = 25f1f517, unchanged)
| PR | Head | Base |
|---|---|---|
| #79 deps | 7220c098 | main |
| #78 owner boundary | 23b6968d | main |
| #80 bridge secret | e3a35aa3 | #78 |
| #81 residual hardening | 0858df3a (was ddcdd70f at start; 4 commits added after review) | #80 |
Integration branch `integration/final-04`: merges in order #79, #78, #80, #81. No conflicts, no duplicate commits. Code SHA verified: `eb7998ad711abf34bbe267943b9f1b6d191ad3e3`. This manifest is a docs-only commit on top.
Merge method: land in order #79, #78, #80, #81 (retarget #80/#81 to main as each lands), or merge the integration branch as one PR. Do not merge #78 before #79.

## Evidence on eb7998ad (local, exact SHA)
tsc 0 errors; eslint 0 errors (192 warnings, all pre-existing, none new errors); vitest 815 passed / 4 skipped; `next build` OK;
`npm audit` 0 critical, 22 high (see residuals); authorization inventory, API-surface classification, shared-cookie and preview-CSP tests included in the 815.
GitHub Actions on the exact head: not run, because #80/#81 are stacked on non-main bases and the integration branch has no PR. #79 CI is green including `security`; #78 `security` fails alone (needs #79). Open a PR from `integration/final-04` to main to get CI on this exact tree.
Real server (`next start`, test secrets, simulated tunnel headers): unauthenticated API 401 incl. forged Host/X-Forwarded-Host; page 307 to absolute `https://<Host>/command-login`; cross-site and origin-less cookie POST 403; telegram, vapi, push, chat webhook and prospector cron 401 without secret; cron GET 405; bridge POST 401; preview unauthenticated 401 and its wire response carries `sandbox allow-scripts`; METTLE session without cookie 401; health 200.
Secret scan: old bridge literal in 0 client chunks and 0 server bundles; remains only in the guard test that forbids it. `x-bridge-secret` in 0 client chunks.

## Firestore and Supabase
Deployed Firestore ruleset `bb269dc3` (updated 2026-10-06): `command-center/**` allow false, default deny; read-only inspection; no rules file changed by this integration. Unauthenticated REST read: 403.
Supabase (command-center-hq, read-only SQL): RLS on for every public table; anon has no privilege on messages, channels, missions, agent_profiles. Anon policies exist only on baba_call_time_rsvp (insert), parallax_bets and parallax_odds_cache (read/write, betting product). Tables pipeline_* and jobs grant anon but have RLS with no anon policy (denied).

## METTLE session compatibility
`shared-cookie-interplay.test.ts` (simulated browser, mocked Firebase): owner CC login valid for METTLE; METTLE login replaces the cookie and CC denies it (account switch); athlete custom-token never opens CC; owner METTLE 30-day cookie older than 12h is denied by CC but still valid for METTLE; DELETE revokes server-side so a copied cookie is dead in both; verifier null denies both. Real Firebase not exercised (production NO-GO item 1).

## Environment requirements (names only)
iMac release env (`41d183a0` files): present PARALLAX_OWNER_UID, FIREBASE_SERVICE_ACCOUNT, OPENCLAW_GATEWAY_TOKEN, BRIDGE_API_SECRET. **Missing, fail closed until set:** TELEGRAM_WEBHOOK_SECRET, TELEGRAM_APPROVER_IDS, VAPI_WEBHOOK_SECRET, CC_PUSH_SECRET, PROSPECTOR_CRON_SECRET. Optional: OPENCLAW_CC_WEBHOOK_TOKEN (falls back to gateway token), CC_ALLOWED_ORIGINS (only if Host is rewritten).
Vercel production (names via CLI): present BRIDGE_API_SECRET, OPENCLAW_GATEWAY_TOKEN, FIREBASE_SERVICE_ACCOUNT, SUPABASE_SERVICE_ROLE_KEY. PARALLAX_OWNER_UID and all machine secrets absent, so Command Center on Vercel returns 503 (dark by design) and METTLE is unaffected. Preview and development scopes not inspected.
Fail-closed behavior is test-enforced: owner unset 503; every machine route 401 with secret unset, empty or wrong, on every method.

## Independent review (fresh Opus agent, then same agent for deltas)
8b253339: one blocker (preview CSP dropped by the global CSP) , fixed. d0c2e263: blocker confirmed fixed; found encoded-path bypass of `/yolo-builds` static serving, fixed in 0858df3a (public fallback removed, iframes sandboxed, regression test). Live iMac release has no `public/yolo-builds` (checked read-only). The final delta after d0c2e263 was verified by me, not re-reviewed.

## Previously reported findings, classified
| Finding | Severity | Exposure | Status |
|---|---|---|---|
| Realtime `cc-push` public broadcast | Medium | Anyone with the public anon key can read speak-flagged agent output and spoof toasts that trigger owner-session TTS; no XSS. Requires Realtime public access on (dashboard setting not checkable). anon table access is already denied. | OPEN. Fix: deliver via the owner-only relay or private channel with a realtime.messages policy. Not merge-blocking; fix before relying on agent voice. |
| `/api/free-audit` | Medium | Overwrite of existing leads (erased opt-out/DNC) | FIXED on existing leads. New-lead path still records unverified `consent:true` and spam rows (no rate limit); no code auto-acts on it (call gate reads consent.toCall; email is owner-approved). Low residual; add Turnstile/double opt-in. |
| METTLE middleware Host-derived fetch | Low | Not attacker-controllable behind the tunnel or on Vercel; pages are client shells; gate accepts any valid Firebase session by design | OPEN, hygiene; verify cookie in-process. |
| Chat webhook shares gateway token | Low | one secret, two uses | OPEN; set OPENCLAW_CC_WEBHOOK_TOKEN. |
| Bridge secret exposed in history | High until rotated | POST /api/bridge accepts the old value on iMac | OPEN, founder action; runbook in CC-BRIDGE-SECRET-ROTATION. |
| parallax_bets / odds_cache anon write | Low-Medium | other product | OPEN, noted. |

## Residual risks
22 high advisories (mostly transitive; nodemailer 8.0.7 flagged, unused code paths, fix is a major bump). 10 unauthenticated METTLE-side routes (see readiness doc section 5), notably push/send. Cloudflare Access policy unverified (no access). Host-rewriting tunnel would 403 owner mutations unless CC_ALLOWED_ORIGINS is set.

## Rollback dependencies
Rollback target `cockpit-releases/41d183a0` stays intact. Code rollback = repoint launchd to it and kickstart; no data migration. Env additions are harmless to the old release. After promotion, rolling back re-exposes the old unauthenticated behavior, so rollback is a last resort. Secret rotation, once done, must be mirrored in any rolled-back release's `.env.local`.
