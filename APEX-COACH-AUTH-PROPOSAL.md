# Path B — server-verified coach session (restores roster cloud sync)

Drafted 2026-06-24. **Nothing here is deployed or active.** All new files are `.proposed`. Restores secure coach roster→Firestore persistence (down since June 3, when the live rules first denied `/organizations`) without a full Firebase-Auth migration.

## What it does
The browser proves the org PIN to the server (not just to itself). On success the server sets a short-lived, HMAC-signed httpOnly cookie that `/api/apex-athlete/roster` trusts. Strictly better than today: the PIN becomes **server-verified + rate-limited**, and the roster gets a **cloud backup** again — with `/organizations` staying locked to the world.

## Files (all `.proposed`, inert)
- `src/lib/apex-coach-token.ts.proposed` — HMAC mint/verify (mirrors `oauth-credentials.ts`).
- `src/app/api/apex-athlete/coach-session/route.ts.proposed` — `POST {pin}` → verify → set cookie; `DELETE` → logout. Rate-limited; PIN never logged.
- `src/app/api/apex-athlete/roster/route.ts.proposed` — Admin-SDK roster GET/POST; `authorizeCoach()` accepts the HMAC cookie (Path B) **or** a Firebase `__session` (Path A).

## ⚠️ Security finding (fix alongside)
The PIN is `process.env.NEXT_PUBLIC_MASTER_PIN || "2451"`. The `NEXT_PUBLIC_` prefix **ships it in the client JS bundle** (public), and it defaults to the weak `2451`. Set a real **server-only** PIN and stop shipping it to browsers.

## Env (server-only — NOT NEXT_PUBLIC_)
```
MASTER_PIN=<the real coach PIN>          # the route falls back to NEXT_PUBLIC_MASTER_PIN for continuity
APEX_SESSION_SECRET=<32+ random bytes>   # e.g. openssl rand -base64 48
```

## Activation order (rules already deployed — do these to RESTORE sync)
```
# 1. Rename the three proposed files to drop .proposed:
mv src/lib/apex-coach-token.ts.proposed src/lib/apex-coach-token.ts
mv src/app/api/apex-athlete/coach-session/route.ts.proposed src/app/api/apex-athlete/coach-session/route.ts
mv src/app/api/apex-athlete/roster/route.ts.proposed src/app/api/apex-athlete/roster/route.ts
# 2. Set MASTER_PIN + APEX_SESSION_SECRET in Vercel + .env.local.
# 3. Apply the two diffs below. 4. Deploy. 5. Test: coach unlock, then roster save/reload across devices.
```

### Diff 1 — establish the server session on coach PIN login
In `src/app/apex-athlete/auth.ts`, after a successful admin/coach PIN unlock (in `loginWithPin`, the `MASTER_PIN` / stored-admin-PIN branches that `setSession({role:"admin"...})`), also call the server:
```ts
// after setSession(session) for an admin/coach unlock:
try {
  await fetch("/api/apex-athlete/coach-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ pin }),   // the same PIN the user just entered
  });
} catch { /* offline: roster stays localStorage-only this session */ }
```
And in `clearSession()`, best-effort `fetch("/api/apex-athlete/coach-session", { method: "DELETE", credentials: "include" })`.

### Diff 2 — point storage-service.ts at the route (replace client Firestore)
```diff
   // 2. Save to Firestore (Async backup)
   try {
-    if (orgId && db) {
-      await setDoc(doc(db, 'organizations', orgId, 'rosters', 'all'), {
-        athletes: roster, updatedAt: new Date().toISOString(), totalXP
-      }, { merge: true })
-    }
+    await fetch('/api/apex-athlete/roster', {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      credentials: 'include',
+      body: JSON.stringify({ orgId, athletes: roster }),
+    })
   } catch (e) { console.error('Roster save failed (offline?)', e) }
```
```diff
   // 2. Fallback to Firestore
-  if (!db) return null
   try {
-    const snap = await getDoc(doc(db, 'organizations', orgId, 'rosters', 'all'))
-    if (snap.exists()) {
-      const roster = snap.data().athletes as Athlete[]
-      localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(roster))
-      return roster
-    }
+    const res = await fetch(`/api/apex-athlete/roster?orgId=${encodeURIComponent(orgId)}`, { credentials: 'include' })
+    if (res.ok) {
+      const { athletes } = await res.json()
+      if (Array.isArray(athletes) && athletes.length) {
+        localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(athletes))
+        return athletes as Athlete[]
+      }
+    }
   } catch (e) { console.error('Roster load failed', e) }
```
Then remove the now-unused `db`/`doc`/`getDoc`/`setDoc` imports.

## Caveats (honest)
- A **shared** org PIN = no per-coach accountability. This is the right *interim*; Path A (Firebase Auth per-coach accounts — infra already built: `createSessionCookie`/`verifySessionCookie`/`/api/auth/session`) is the right *destination*. The roster route already supports Path A, so migrating later is drop-in.
- `auth.ts` ALSO reads athlete PINs straight from `organizations/{orgId}/rosters` via the **client** SDK (`loginWithPin` step 3, `loadRosterFromFirestore`). Those now fail against the locked rule too → athlete PIN login currently falls back to the localStorage roster only. To fully restore cross-device athlete login, those reads also need to move behind an Admin-SDK route (same pattern). Flagging as the next item.
- Rate limiter is per-instance (in-memory). For serverless multi-instance, back it with Upstash/KV.
