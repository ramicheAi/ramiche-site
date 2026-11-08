# CC-FOUNDER-AUTHORITY-GUARD-01: server-verified founder authority

Mission: SECURITY-CONTAINMENT-01. Requirement, verbatim:

> "A client-supplied identity or local browser PIN state must not establish founder authority."

Base: `origin/main` @ 25f1f517. Related but separate: #69 (authorization assessment), #70 (parallax_bets/odds_cache).

## 1. What is wrong today

- `src/app/api/command-center/auth/pin/route.ts` checks the PIN and returns `{ ok: true }`. It issues no cookie, token, or session.
- The "unlocked" state lives only in the browser: `src/app/command-center/layout.tsx` writes `sessionStorage['cc-pin-auth'] = {ok:true,...}` after a 200 (line ~120). No server code reads it back.
- So every privileged API route below is reachable by anyone who can send an HTTP request. The PIN gate is UI-only, and attributions such as `decided_by: "ramon"` or `Decision by: Ramon` are string literals, not verified identities.

## 2. The mechanism (prepared, dormant by default)

| Piece | File |
|---|---|
| Signing, verification, one-call guard | `src/lib/server/founder-authority.ts` |
| Cookie issued on a correct PIN | `src/app/api/command-center/auth/pin/route.ts` (`pinAccepted()`) |
| Worked example (opt-in) | `src/app/api/command-center/yolo-approve/route.ts` |

**Session:** a stateless HMAC-SHA256 signed cookie.

- Name `cc_founder_session`. Value `v1.<expiresAtMs>.<base64url mac>`. The MAC covers `cc-founder.v1.<expiresAtMs>`.
- Cookie attributes: `HttpOnly`, `Secure` (everywhere except `NODE_ENV=development`), `SameSite=Strict`, `Path=/api/command-center`. Absolute lifetime 8h, no sliding refresh.
- Signing key: new env var `COMMAND_CENTER_SESSION_SECRET`, at least 32 chars. Generate it with `openssl rand -base64 48`. Shorter or unset counts as not configured.
- The token holds no PIN, no PIN hash, no identity, and is never in the JSON body.
- `verifyFounderAuthority(request)` reads only that cookie from the `Cookie` header. Body fields, custom headers, `Authorization`, query strings and the `cc-pin-auth` sessionStorage shape are never consulted, and tests confirm forged versions of each are rejected.

**Why a signed cookie and not a DB session table:** there is one founder and one credential (the PIN). A signed cookie needs no migration, no Supabase write path, and no new failure mode on every privileged request. Its costs, accepted on purpose:
- Individual sessions cannot be revoked. Rotating `COMMAND_CENTER_SESSION_SECRET` revokes all of them at once.
- The PIN route has no logout endpoint yet.

If per-device revocation or an audit trail of sessions becomes a requirement, add a `cc_founder_sessions` table keyed by a random session id carried in the same cookie. The guard API stays the same.

**Why not reuse an existing secret:** the existing secrets are `BRIDGE_API_SECRET`, `CC_PUSH_SECRET`, `CRON_SECRET`, `CF_ACCESS_CLIENT_SECRET` and the Stripe keys, and each authenticates a different machine caller. Reusing one would let anyone holding that machine credential mint founder sessions. A dedicated key keeps the trust domains separate.

**CSRF:** `SameSite=Strict` stops the browser from attaching the cookie to cross-site requests. A follow-up could add an Origin check inside `requireFounderAuthority` for defense in depth. It is not included here.

### Enforcement switch

```ts
import { requireFounderAuthority } from "@/lib/server/founder-authority";

export async function POST(request: Request) {
  const denied = requireFounderAuthority(request, "<route-key>");
  if (denied) return denied;
  // ...existing handler unchanged
}
```

- Enforcement is controlled by `CC_FOUNDER_GUARD_ENFORCE`. It accepts `all` or a comma list of route keys.
  - **Unset or empty (the default):** the guard returns `null` and the route behaves exactly as it does today.
  - **Enforced, valid cookie:** the request proceeds.
  - **Enforced, missing, tampered, wrong-secret or expired cookie:** `401 {code:"founder_authority_required"}`. The handler never runs.
  - **Enforced, `COMMAND_CENTER_SESSION_SECRET` missing:** `503 {code:"founder_authority_not_configured"}`. It fails closed, never open.

## 3. Live behavior after this PR merges (unambiguous)

- **No route's access control changes.** With `CC_FOUNDER_GUARD_ENFORCE` unset, which is the production state unless a human sets it, `yolo-approve` stays unguarded, exactly as today.
- **`auth/pin` is unchanged unless `COMMAND_CENTER_SESSION_SECRET` is set.** It still returns the same `{ ok: true }` / 401 / 503 bodies and statuses. When the secret is set, a successful PIN response also carries the `Set-Cookie` header. That is additive, and no route requires the cookie until enforcement is on.
- **The client needs no change.** Same-origin `fetch` sends cookies by default, so the existing `yolo/page.tsx` call works once enforcement is on, provided the founder unlocked after the secret was set.

**Rollout, a founder decision:**
1. Set `COMMAND_CENTER_SESSION_SECRET` in Vercel and redeploy.
2. Re-enter the PIN once. Older sessionStorage-only unlocks carry no cookie.
3. Set `CC_FOUNDER_GUARD_ENFORCE=yolo-approve` and confirm.
4. Widen the list route by route.

**Caveat:** the UI does not yet react to a 401 by re-showing the PIN gate. A founder whose cookie expired while sessionStorage still says unlocked gets a 401 until they reload and re-enter the PIN. Fix that in the UI follow-up before enforcing `all`.

## 4. Routes that need the guard, in priority order

"Wire" means adding the two lines above with the route key shown. Only `yolo-approve` is wired in this PR.

| # | Route key | File | Current gap (main @ 25f1f517) | What wiring changes |
|---|---|---|---|---|
| 1 | `gate` | `src/app/api/command-center/gate/route.ts` | `POST` (l.45) approves a founder-gate item with no check, stamps `decided_by: "ramon"` as a literal (l.68), and for `kind === "send"` sends real SMTP mail (l.76, l.101). | Approval and send require a server-signed founder session, so the `decided_by` stamp is backed by a verified session. **Note:** the mission brief called this `chat/gate`. No such route exists on main. This is the one. |
| 2 | `yolo-approve` | `src/app/api/command-center/yolo-approve/route.ts` and `handler.ts` | Writes approvals and `Decision by: Ramon` memory entries (handler l.80, l.119) and spawns a gateway session, with no identity check. | **Wired (opt-in).** When enforced, the handler is never loaded without a valid cookie. |
| 3 | `chat-approve` | `src/app/api/command-center/chat/approve/route.ts` | `POST` (l.19) approves any synthesis `messageId` from the body with no check. | Approval requires the founder session. |
| 4 | `chat-approve-stream` | `src/app/api/command-center/chat/approve/stream/route.ts` | `POST` (l.47), same as #3 over SSE. | Same. Return the guard's JSON 401 before opening the stream. |
| 5 | `voice-call` | `src/app/api/command-center/voice/call/route.ts` | `POST` (l.22) places a real outbound Vapi call. `toNumber` comes straight from the request body (l.26, l.42). | Outbound calls require the founder session. Allowlisting the destination is a separate follow-up. |
| 6 | `leads-send` | `src/app/api/command-center/leads/send/route.ts` | `POST` (l.19) sends the cold email for any `leadId` from the body with no check. **Correction to the brief:** the recipient comes from the lead row (`lead.contact_email` / `meta.intel.contactEmail`, l.35), not the body. The caller still picks which lead gets mailed. | Outbound email requires the founder session. |
| 7 | `agents` | `src/app/api/command-center/agents/route.ts` | `POST` (l.119) rewrites any agent's model/provider in the directory file (l.154) with no check. | Roster mutation requires the founder session. `GET` stays open. |
| 8 | `settings` | `src/app/api/command-center/settings/route.ts` | `POST` (l.82) runs gateway actions with no check: `restart-gateway`, `reload-crons`, `run-doctor`, `cron-enable/disable`, plus reads of sessions and history. | Settings and gateway control require the founder session. `GET` stays open. |

Machine-to-machine routes (`chat/webhook`, `crons`, `push`, `telegram/webhook`) keep their existing shared-secret checks and are out of scope. A founder cookie is the wrong credential for a bot.

## 5. Tests

- `src/lib/server/founder-authority.test.ts` covers: valid accepted; tampered signature or expiry rejected; expired rejected; missing rejected; wrong secret rejected; malformed or client-invented values rejected; body, header and sessionStorage-shaped identity ignored; short secret treated as not configured; enforcement flag parsing; 401, 503 and pass-through.
- `src/app/api/command-center/auth/pin/route.test.ts` covers: a cookie only on a correct PIN (hash and plaintext paths); no cookie on a wrong PIN; no cookie and an unchanged body when the secret is unset; HttpOnly, Secure, SameSite=Strict and Path attributes.
- `src/app/api/command-center/yolo-approve/route.test.ts` covers:
  - Default, unguarded.
  - Enforced for another key only, still unguarded.
  - Enforced: no cookie gives 401; a forged identity gives 401; an expired or foreign cookie gives 401; a missing secret gives 503. The handler never runs in any of these.
  - End to end: the PIN-issued cookie unlocks the route.

## 6. Out of scope

- Wiring routes #1 and #3 to #8.
- UI handling of 401s.
- Logout and revocation.
- Origin/CSRF header check.
- Destination allowlists.
- Any Supabase or migration change.
