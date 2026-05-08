# METTLE Firebase Auth Migration Plan
*Created: Mar 22, 2026 — Atlas*

## Current State
- Auth = 100% client-side localStorage (`auth.ts`, 337 lines)
- Firestore = data storage only (no Firebase Auth SDK)
- Sessions: `AuthSession` object in localStorage, 30-day expiry
- Coach accounts: localStorage (`apex-auth-coach-accounts`)
- Parent accounts: localStorage (`apex-auth-parent-accounts`)
- Athlete PINs: Firestore lookup (already server-side)
- Master PIN: env var `NEXT_PUBLIC_MASTER_PIN`

## Files That Import Auth (6 pages + 2 hooks)
1. `login/page.tsx` — main login form
2. `coach/page.tsx` — coach portal auth check
3. `parent/page.tsx` — parent portal auth check
4. `athlete/page.tsx` — athlete portal auth check
5. `page.tsx` — root redirect by role
6. `join/page.tsx` — parent enrollment
7. `hooks/useCoachAuth.ts` — coach auth state
8. `hooks/useCoachUI.ts` — references auth

## Risk Assessment
- **HIGH RISK**: Auth touches every portal. Breaking = 240+ athletes locked out.
- **PREVIOUS FAILURE**: Bulk refactor deleted working code, caused regressions.
- **CONSTRAINT**: Must maintain backward compatibility during migration.

## Strategy: Dual-Write Migration (Zero Downtime)

### Phase 1: Add Firebase Auth SDK (ADDITIVE ONLY)
**Goal:** Install Firebase Auth, create wrapper. ZERO changes to existing auth flow.

1. Add `firebase/auth` import to `src/lib/firebase.ts`
2. Create `src/app/apex-athlete/lib/firebase-auth.ts`:
   - `initFirebaseAuth()` — get auth instance
   - `fbSignUp(email, password)` — create Firebase Auth user
   - `fbSignIn(email, password)` — sign in
   - `fbSignOut()` — sign out
   - `fbGetCurrentUser()` — get current user
   - `fbOnAuthStateChanged(callback)` — listener
3. **NO existing code modified. NO existing imports changed.**
4. Build + deploy. Verify nothing breaks.

### Phase 2: Dual-Write Coach Login (ONE function change)
**Goal:** `loginCoach()` writes to BOTH localStorage AND Firebase Auth.

1. Modify `auth.ts:loginCoach()` ONLY:
   - After successful localStorage auth, ALSO call `fbSignUp` (if first time) or `fbSignIn`
   - If Firebase call fails, still succeed (localStorage is primary)
   - Log success/failure to console
2. Build + deploy. Test coach login manually.
3. Verify: localStorage session works. Firebase Auth dashboard shows new user.

### Phase 3: Dual-Write Parent Login (ONE function change)
**Goal:** `loginParent()` writes to BOTH localStorage AND Firebase Auth.

1. Modify `auth.ts:loginParent()` ONLY:
   - Same dual-write pattern as Phase 2
   - Parent uses verification code, not password — bridge with custom token or temp password
2. Build + deploy. Test parent login.

### Phase 4: Dual-Write PIN Login (ONE function change)
**Goal:** `loginWithPin()` creates anonymous Firebase Auth session alongside localStorage.

1. Modify `auth.ts:loginWithPin()` ONLY:
   - After PIN match, call `signInAnonymously()` from Firebase Auth
   - Store Firebase UID alongside existing session
2. Build + deploy. Test athlete PIN login.

### Phase 5: Read from Firebase Auth (gradual cutover)
**Goal:** Portal pages check Firebase Auth state AS SUPPLEMENT to localStorage.

1. Update `useCoachAuth.ts`:
   - Check Firebase `onAuthStateChanged` IN ADDITION TO `getSession()`
   - If Firebase says logged in but localStorage says no → restore session from Firebase
2. Update each portal page (one at a time, one commit each):
   - `coach/page.tsx`
   - `parent/page.tsx`
   - `athlete/page.tsx`
3. Build + deploy after EACH page. Verify EACH time.

### Phase 6: Remove localStorage auth (30 days after Phase 5)
**Goal:** Clean cutover after all sessions have naturally migrated.

1. Remove `loadJSON`/`saveJSON` helpers
2. Remove `COACH_ACCOUNTS_KEY`/`PARENT_ACCOUNTS_KEY` constants
3. Point `getSession()` to Firebase Auth only
4. Clean up legacy `sessionStorage` compat code

## Rules
- ONE phase per session. Never batch.
- Git commit after EVERY change.
- Build must pass before push.
- Curl the URL after every deploy.
- If build breaks → `git revert HEAD` immediately.
- Phase 6 is 30 DAYS from now. Not sooner.

## Start: Phase 1 (today)
