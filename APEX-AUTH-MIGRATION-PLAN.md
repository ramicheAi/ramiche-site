# Apex-Athlete Auth Migration (Path A) — restore the client data layer, securely

Drafted 2026-06-24. **Plan only — no code/deploy.** Goal: re-enable the apex-athlete app's full Firestore client layer (54 call-sites across 13 files + 2 real-time listeners), which the `/organizations → if false` lockdown denies, **without re-opening the minors' PII**. The fix is real per-user auth + scoped rules — not 15 proxy routes.

## Why custom claims (and why the existing `firebase/firestore.rules` can't be used as-is)
- The written RBAC rules assume `teams/{teamId}/athletes/{firebaseUid}` + `roles/{uid}` — **uid-keyed membership docs**.
- The live data is `organizations/{orgId}/rosters/all = {athletes:[…]}` + `config/*`, `schedules/*`, `feedback/{athleteId}`, `wellness/{athleteId}`, `athletes/{athleteId}/*` — **org-scoped, array-based, NOT keyed by Firebase uid**.
- Reconciling those via `get()/exists()` rules would require a full data re-key (huge). **Custom claims avoid that entirely:** the server stamps `{orgId, role, athleteId}` onto each user's token; rules check the token. Zero data migration; restores real-time listeners natively.

## Architecture — the custom-token bridge
Reuses the credentials that already exist (admin/athlete PIN, coach email+password); just makes the resulting identity server-minted and rule-enforceable.

```
Client enters PIN / email+password
   → POST /api/apex-athlete/coach-session  (or /athlete-login)   [verifies the credential server-side, as today]
   → server: adminAuth.createCustomToken(uid, { orgId, role, athleteId })
   → returns the custom token
Client → signInWithCustomToken(token)   → real Firebase session whose token carries {orgId, role, athleteId}
Firestore rules → gate on request.auth.token.orgId / .role / .athleteId
```
The `/coach-session` route I already built becomes the mint point (swap the HMAC token for a Firebase custom token). `firebase-auth.ts` already wraps the Firebase Auth SDK; `firebase-admin.ts` already has `getAuth()`.

## The scoped rules (new — org schema, claim-based)
```firestore
function authedOrg(orgId) { return request.auth != null && request.auth.token.orgId == orgId; }
function isCoach(orgId)   { return authedOrg(orgId) && (request.auth.token.role in ['coach','admin']); }
function isAthlete(id)    { return request.auth != null && request.auth.token.athleteId == id; }

match /organizations/{orgId} {
  // Full roster carries minor PII (birthday, parentEmail) → coaches only, never all members.
  match /rosters/{doc}          { allow read: if isCoach(orgId); allow write: if isCoach(orgId); }
  match /config/{doc}           { allow read: if authedOrg(orgId); allow write: if isCoach(orgId); }
  match /schedules/{doc}        { allow read: if authedOrg(orgId); allow write: if isCoach(orgId); }
  match /audit/{doc}            { allow read, write: if isCoach(orgId); }
  match /snapshots/{doc}        { allow read, write: if isCoach(orgId); }
  match /feedback/{athleteId}   { allow read: if isCoach(orgId) || isAthlete(athleteId); allow write: if isCoach(orgId); }
  match /wellness/{athleteId}   { allow read, write: if isCoach(orgId) || isAthlete(athleteId); }
  match /athletes/{athleteId}/{document=**} {
    allow read, write: if isCoach(orgId) || isAthlete(athleteId);
  }
}
match /{document=**} { allow read, write: if false; }   // floor stays
```
Net: per-org isolation, coach-only writes + roster PII, athletes scoped to their own data — strictly tighter than the original open rule, and it restores every client call-site + both listeners.

## Phases (each is independently safe; the data never re-opens until Phase 3)
- **Phase 0 — DONE.** Exposure closed (live ruleset `9e3d12b1`); interim Admin-SDK routes for the two critical flows (coach roster, athlete login).
- **Phase 1 — mint claims (no rule change).** Add `createCustomToken({orgId,role,athleteId})` to the auth routes; client `signInWithCustomToken` after the existing PIN/password check. Deploy. Rules unchanged → still locked → no exposure. Verify every client now has an authenticated session carrying the right claims (check `request.auth.token` in the console / a debug endpoint).
- **Phase 2 — validate rules off-prod.** Deploy the claim-based rules to a **preview/staging Firebase project** (or the Firestore emulator) seeded with sample data. Exercise all 54 call-sites + both listeners as coach / athlete / wrong-org. Confirm reads/writes succeed for the right role and 403 for the wrong one.
- **Phase 3 — cutover.** Deploy the claim-based rules to prod. Authenticated clients read/write `/organizations` directly again (scoped). The interim proxy routes can stay as belt-and-suspenders or be retired. Monitor Firestore "denied" metrics for a few days.
- **Phase 4 — harden.** Turn App Check to Enforce; retire the localStorage-only crutches where cloud is now authoritative.
- **Rollback (any phase):** redeploy `organizations/** → if false`. Instantly back to interim-routes + localStorage. Reversible, no data loss.

## Identity details
- **Coaches:** real email/password Firebase accounts (the `registerCoach` dual-write already creates them). Server verifies password → custom token with `role:'coach'|'admin'`, `orgId`.
- **Athletes:** no per-athlete account needed — server verifies the PIN → custom token with `role:'athlete'`, `athleteId`, `orgId`. (uid can be `apex_${athleteId}` for stability.)
- **Admin (master PIN):** custom token with `role:'admin'`, `orgId`.
- Claims are **server-minted after a credential check → unforgeable**; expiry via token TTL + refresh.

## Effort & risk (honest)
- **~2–4 focused days.** Phase 1 (mint + client sign-in) ~0.5d; rules + emulator validation ~1d; cutover + monitor ~0.5d; sweep the 54 call-sites for assumptions that break under real auth (e.g., code that assumed reads always "succeed") ~1d.
- **Main risks:** (1) a call-site that wrote with no auth now needs a coach session in context; (2) real-time listeners must be re-tested under rules; (3) getting the `orgId` claim onto every session before Phase 3 (else those users get denied at cutover — that's why Phase 1 ships claims first and Phase 3 waits until coverage is ~100%).

## What I can build vs. what needs you
- **I build (as `.proposed`, reviewable):** the `createCustomToken` mint in the auth routes, the `signInWithCustomToken` client wiring, and the claim-based `firestore.rules`.
- **You:** stand up a preview/staging Firebase project (or approve emulator use) for Phase 2, set the env secrets, and pick the cutover window.

## North star
This dissolves the 54-call-site problem instead of patching it. When it lands: the app's cloud layer + real-time work again, scoped per-org/per-role, behind App Check — a security posture **better than the original open rule**, appropriate for a product holding minors' data. The interim routes (Path B) keep the critical flows alive in the meantime.
