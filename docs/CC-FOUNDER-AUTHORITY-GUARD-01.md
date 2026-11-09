# CC-FOUNDER-AUTHORITY-GUARD-01: server-verified founder authority

Mission: SECURITY-CONTAINMENT-01, completed under CC-SECURITY-COMPLETION-02 (2026-11-08).
Requirement, verbatim:

> "A client-supplied identity or local browser PIN state must not establish founder authority."

Base: `origin/main` @ 25f1f517. Related but separate: #69 (authorization assessment), #70
(parallax_bets/odds_cache). **Status: mechanism complete, eight privileged routes wired,
enforcement deliberately still OFF by default.** Nothing in production changed when this merged.

## 1. What was wrong

- `src/app/api/command-center/auth/pin/route.ts` checked the PIN and returned `{ ok: true }`. It
  issued no cookie, token, or session, and had no rate limiting.
- The "unlocked" state lived only in the browser: `src/app/command-center/layout.tsx` wrote
  `sessionStorage['cc-pin-auth']` after a 200. No server code ever read it back.
- Every privileged API route was therefore reachable by anyone who could send an HTTP request. The
  PIN gate was UI-only, and attributions such as `decided_by: "ramon"` were string literals, not
  identities.
- Cookie-authenticated mutations had no Origin check, so a signed cookie (once it existed) would
  have been usable cross-site.
- An expired or revoked server session would have left the browser flapping against 401s with no
  route back to the PIN gate.

## 2. The mechanism

| Piece | File |
|---|---|
| Signing, verification, revocation, origin check, machine credential, one-call guard | `src/lib/server/founder-authority.ts` |
| PIN brute-force protection (per-client + global breaker) | `src/lib/server/pin-rate-limit.ts` |
| Cookie issued on a correct PIN, rate-limited | `src/app/api/command-center/auth/pin/route.ts` |
| Read-only session state for the browser | `src/app/api/command-center/auth/state/route.ts` |
| Browser recovery on session loss | `src/app/command-center/layout.tsx` |
| Wired privileged routes | the eight listed in §3 |

### Session token

- Cookie name `cc_founder_session`. Value `ccf2.<issuedAtMs>.<expiresAtMs>.<base64url mac>`; the
  MAC covers `cc-founder.v2.<issuedAtMs>.<expiresAtMs>`.
- Cookie attributes: `HttpOnly`, `Secure` (everywhere except `NODE_ENV=development`),
  `SameSite=Strict`, `Path=/api/command-center`. Absolute lifetime 8h, no sliding refresh.
- Signing key: `COMMAND_CENTER_SESSION_SECRET`, at least 32 chars (`openssl rand -base64 48`).
  Shorter or unset counts as not configured.
- The token holds no PIN, no PIN hash, no identity, and never appears in a JSON body.
- `verifyFounderAuthority(request)` reads only that cookie. Body fields, custom headers,
  `Authorization`, query strings and the `cc-pin-auth` sessionStorage shape are never consulted;
  tests assert forged versions of each are rejected.
- A token whose `issuedAt` is in the future beyond a 60s clock skew, or older than the absolute
  TTL, is rejected even if its `expiresAt` looks valid.

**Why a signed cookie and not a DB session table:** one founder, one credential, and no new write
path on every privileged request. The accepted cost is that individual sessions cannot be revoked
per device. That is stated as a limitation, not faked.

### Revocation and rotation

- **Kill switch:** `CC_FOUNDER_REVOKE_BEFORE` — epoch ms or any ISO-8601 timestamp. Every session
  issued at or before that instant is rejected with `reason: "revoked"`. This is stateless and
  immediate on the next request. An unparseable value is logged and treated as "nothing revoked";
  it never fails open silently.
- **Secret rotation:** changing `COMMAND_CENTER_SESSION_SECRET` invalidates every outstanding
  session at once.
- Per-device revocation needs a stored session id; deliberately not invented here.

### PIN brute-force protection

- Per client (leftmost `x-forwarded-for`, then `x-real-ip`, else a single shared bucket): 5
  failures in 15 minutes locks that client for 15 minutes; each repeat lockout doubles (15m, 30m,
  60m, 120m cap). A correct PIN clears only that client's bucket.
- Global circuit breaker: 50 failures in 10 minutes from any mix of clients locks all PIN
  verification for 10 minutes. This is the answer to distributing guesses across many addresses.
- The 429 carries `Retry-After`; the lockout is checked **before** the PIN is compared, so a
  correct PIN cannot be used to probe a locked-out account.
- **Dev PIN:** the fixed fallback `2451` is hard-blocked whenever `NODE_ENV=production`, even if
  `CC_PIN_ALLOW_DEV=1`. A fixed public PIN can never be the production credential.
- **Honest limitation:** the counters are per server instance. On Vercel each warm lambda has its
  own map, so the real ceiling is `instances × 5` guesses per window, not 5. Still a large
  reduction from unlimited. A shared store (Redis/Upstash or a Supabase table) is the correct next
  step if an exact global count is required; it was not added because it puts a new write path and
  a new failure mode in front of the unlock screen.

### CSRF

On top of `SameSite=Strict`, `requireFounderAuthority` checks Origin (falling back to Referer)
against `x-forwarded-host`/`Host` for every cookie-authenticated mutation. Missing both headers on
a mutation is rejected. A cross-origin mutation with an otherwise valid session gets `403`, not a
pass.

### Machine-to-machine callers

- Header `Authorization: Bearer <COMMAND_CENTER_MACHINE_SECRET>`, compared in constant time.
- **Only** on routes explicitly named in `CC_MACHINE_ROUTES` (comma list, or `all`). Default is
  empty, so turning enforcement on can never silently open a route to machines.
- Both a >= 32-char secret and a listed route are required. This is deliberately independent of the
  existing `BRIDGE_API_SECRET`/`CRON_SECRET`/Cloudflare Access credentials so trust domains stay
  separate.
- Machine routes such as `chat/webhook`, `crons`, `push`, `telegram/webhook` keep their existing
  shared-secret checks and are not part of this list.

### Enforcement switch

```ts
const denied = requireFounderAuthority(request, "<route-key>");
if (denied) return denied;
```

`CC_FOUNDER_GUARD_ENFORCE` accepts `all` or a comma list of route keys.

- **Unset or empty (the default):** returns `null`; the route behaves exactly as before.
- **Enforced, valid cookie + same-origin:** proceeds.
- **Enforced, missing/malformed/forged/expired/revoked cookie:** `401
  {code:"founder_authority_required", reason}`. The handler never runs.
- **Enforced, cross-origin mutation:** `403 {code:"founder_authority_cross_origin"}`.
- **Enforced, secret unset/short:** `503 {code:"founder_authority_not_configured"}`. Fails closed.

Ordering matters and is tested: 401/403/503 are returned **before** the handler can touch SMTP,
the synthesis dispatcher, the gateway, the filesystem, the voice provider or Supabase.

## 3. Routes wired in this PR

Eight privileged `POST` handlers, each with `requireFounderAuthority` as the first statement:

| Route key | File |
|---|---|
| `gate` | `src/app/api/command-center/gate/route.ts` |
| `chat-approve` | `src/app/api/command-center/chat/approve/route.ts` |
| `chat-approve-stream` | `src/app/api/command-center/chat/approve/stream/route.ts` |
| `voice-call` | `src/app/api/command-center/voice/call/route.ts` |
| `leads-send` | `src/app/api/command-center/leads/send/route.ts` |
| `agents` | `src/app/api/command-center/agents/route.ts` |
| `settings` | `src/app/api/command-center/settings/route.ts` |
| `yolo-approve` | `src/app/api/command-center/yolo-approve/route.ts` |

`src/app/api/command-center/auth/pin/route.ts` is the minting route and is not itself guarded
(guarding it would be circular); it is rate-limited instead. `auth/state` is intentionally
read-only and unguarded so the browser can discover that its session is gone.

## 4. Browser recovery

`src/app/command-center/layout.tsx` now asks `GET /api/command-center/auth/state` on mount, on
window focus, and on visibility change while the UI believes it is unlocked. On `401` it clears
`sessionStorage['cc-pin-auth']` and shows the PIN gate with a specific notice:

- `expired` → "Your founder session expired. Enter the PIN to unlock again."
- `revoked` → "Your founder session was revoked. Enter the PIN to unlock again."
- anything else → "The server no longer recognises this session. Enter the PIN to unlock again."

A network failure does not lock the founder out of a page that still works. Neither does a 401
that is not a real session loss: the decision is made by `src/app/command-center/session-recovery.ts`,
which refuses to clear the local unlock when the guard is off for every route, or when enforcement
is on but `COMMAND_CENTER_SESSION_SECRET` is missing. Both of those states would otherwise clear
`sessionStorage`, ask for the PIN, and loop forever because the PIN route cannot mint a cookie.
Only "guard on, secret configured, session missing/expired/revoked" is treated as recovery. The
endpoint never mints, refreshes or extends a session, and reveals nothing about the PIN.

## 5. Live behavior after this PR merges

- **No route's access control changes.** `CC_FOUNDER_GUARD_ENFORCE` is unset by default, so all
  eight routes keep their current behaviour.
- **`auth/pin` is additive.** Same bodies and statuses as before; when
  `COMMAND_CENTER_SESSION_SECRET` is set, a correct PIN also sets the cookie. The JSON body never
  contains the token.
- **The client needs no change.** Same-origin `fetch` sends cookies by default.

**Rollout (founder decision, in this order):**

1. Set `COMMAND_CENTER_SESSION_SECRET` in Vercel and redeploy.
2. Re-enter the PIN once; older sessionStorage-only unlocks carry no cookie.
3. Set `CC_FOUNDER_GUARD_ENFORCE=gate` (or another single key) and confirm the browser flow.
4. Widen the list one route at a time.
5. Only after all 46 privileged routes are reviewed, consider `all`.

## 6. Remaining gap for global enforcement

The eight routes above are the ones the mission named. **37 other `POST` routes under
`src/app/api/command-center` are not wired.** Setting `CC_FOUNDER_GUARD_ENFORCE=all` today would
protect the eight and leave the rest exactly as they are; it would not be a global lockdown.

Two groups:

- **Machine callers, keep shared secrets:** `chat/webhook`, `voice/call/webhook`,
  `telegram/webhook`, `crons`, `push`, `ws`, `jobs`, `jobs/[id]`.
- **Browser-facing and still unguarded:** `chat/*` (stream, upload, pin, mark-read, reactions,
  regenerate-image, action-status, chat), `pipeline/*` (leads, diagnose, maintenance, proposals),
  `leads/intel`, `leads/kit`, `prospector/*`, `image-gen`, `briefing/compose`, `oracle`,
  `firestore-sync`, `security`, `roadmap`, `wellness/verse`, `tasks/notify`, `bambu`, `voice/*`
  (speak, atlas, transcribe).

**Recommendation:** enable enforcement per key starting with `gate`, `voice-call`, `leads-send`,
`settings`, `agents`, and `yolo-approve`. Do **not** set `all` until the 37 remaining routes have
each been classified as browser or machine and wired accordingly. This is the single blocker on
calling the Command Center's write surface closed.

## 7. Tests

Baseline `main` + #70's SQL: 53 files / 524 passed / 4 skipped. This branch: **60 files / 635
passed / 4 skipped** (+111 tests), `tsc --noEmit` clean, eslint 0 errors (6 pre-existing
warnings).

- `src/lib/server/founder-authority.test.ts` — valid accepted; tampered expiry and signature
  rejected; wrong secret rejected; expired rejected; issued-in-future and issued-after-expiry
  rejected; v1-era and invented values rejected as `malformed`; empty-string cookie is
  `malformed`, not `missing`; short secret is `not_configured`; 8h TTL; revocation cut-off
  (epoch ms and ISO, invalid ignored); cookie parsing; body/header/sessionStorage identity
  ignored; 401/403/503 ordering; origin from Origin and Referer; suffix-spoofed origin rejected;
  proxy host honoured; machine credential accepted only on listed routes.
- `src/lib/server/pin-rate-limit.test.ts` — client key resolution; 5-then-lock; unlock after
  window; doubling and 2h cap; success clears only that client; clients independent; stale window
  expires; global breaker locks everyone and is not cleared by one success.
- `src/app/api/command-center/auth/pin/route.test.ts` — cookie only on a correct PIN (hash and
  plaintext); no cookie on a wrong PIN; unchanged body when the secret is unset; cookie
  attributes; 429 with `Retry-After` after five failures, including for the correct PIN; the fixed
  dev PIN is refused in production with `CC_PIN_ALLOW_DEV=1`.
- `src/app/api/command-center/yolo-approve/route.test.ts` — default unguarded; enforced for
  another key only; no/forged/expired/foreign cookie → 401; missing secret → 503; end to end
  PIN → cookie → route.
- `src/app/command-center/session-recovery.test.ts` — the recovery decision: no recovery on a
  200; no recovery while enforcement is off (would loop in today's default state); no recovery
  when enforcement is on but the secret is missing (would loop); recovery with a specific notice
  for expired and revoked; a generic notice for missing/malformed/forged; no guessing when the
  response has no enforcement field.
- `src/app/api/command-center/auth/state/route.test.ts` — enforcement on/off/all spellings;
  valid session with expiry; expired, revoked and forged reasons distinguished; `not_configured`
  when the secret is missing; never sets a cookie; `no-store`.
- `src/app/api/command-center/guard-wiring.test.ts` — for each of the eight routes × six cases:
  default unchanged; no cookie → 401; forged cookie → 401; cross-origin valid session → 403;
  same-origin valid session proceeds; missing secret → 503. Side-effect modules are spied on and
  asserted **zero calls** for every denied case. Two machine cases: refused by default, accepted
  only when listed.

## 8. Out of scope

- Wiring the 37 remaining routes (§6) — the only blocker on `all`.
- Per-device revoke/logout and an audit trail of sessions.
- A shared-store rate limiter for exact cross-instance counts.
- Destination allowlists for `voice-call` / `leads-send`.
- Any Supabase or migration change.
