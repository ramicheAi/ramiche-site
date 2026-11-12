# Bridge secret exposure assessment and rotation procedure

Date: 2026-11-11. No secret value appears in this document, the commit, or the PR. Nothing here has been executed: rotation needs the founder's explicit approval.

## 1. Exposure assessment (evidence, values never recorded)

| Location | Finding | How checked |
|---|---|---|
| `src/app/command-center/legacy/page.tsx` | A hardcoded literal was sent as `x-bridge-secret` from the browser. In git history since 2026-03-05 (8 commits on `main` touch it). | `git log -S` |
| Client bundle built from `main` / PR #78 | The literal is inside 1 client chunk. Static chunks are fetchable by hash even when the page route is gated. Treat the literal as public. | grep of `.next/static` after `next build` |
| iMac release `41d183a0` build output | Literal absent from `.next-cc` client and server output (0 files). The p06 line never had this page code. | grep on the iMac |
| Vercel production | The literal is **not** the live secret: `GET /api/bridge/tasks` returns 401 both with no header and with the literal. | status codes only, bodies discarded |
| iMac `~/ramiche-site/.env.local` and `cockpit-releases/41d183a0/.env.local` | `BRIDGE_API_SECRET` **equals the literal** (compared in-shell, not printed). `cockpit-releases/41d183a0/.env.production.local` holds a different value, which Next prefers in production. | in-shell equality test |
| launchd `com.openclaw.bridge-sync` | Passes a secret as a **command-line argument** (visible in the plist and `ps`). That value was displayed once in this investigation's tool output and must be treated as exposed. | plist `ProgramArguments` |
| Scripts | `scripts/bridge-sync.mjs`, `bridge-sync-once.mjs`, `sync-pipeline.js` read `BRIDGE_API_SECRET` from env (fine). | source |

Conclusion: the literal is exposed (git history plus a public client chunk) and is still a live value in two iMac `.env.local` files, so it must be considered a compromised credential wherever it is accepted. The current Vercel value and the launchd argument must also be rotated because the latter was printed.

## 2. What this PR changes (code only)

- The Command Center legacy page no longer holds or sends any bridge secret; it relies on the owner session cookie.
- `bridge/tasks`, `bridge/chat`, `bridge/crons` and `command-center/crons` authorize by owner session only (the browser-held secret check is removed).
- `POST /api/bridge` (the launchd and script sync path) stays secret-gated, now timing-safe and fail-closed.
- A test fails if the literal or any bridge/server secret name appears in a client module.

## 3. Deployed Firestore status (affects how urgent this is)

The deployed ruleset (release `cloud.firestore`, updated 2026-10-06) denies all reads and writes to `command-center/**` and ends with a default-deny. Unauthenticated REST reads of `command-center/agents`, `tasks`, `trigger-queue`, `yolo_builds` and a collection list all returned 403. So the secret cannot currently be used to reach Firestore data through the app's REST path. **Side effect to know about:** the bridge's Firestore REST reads and writes are credential-less, so they cannot succeed against these rules. Bridge sync to Firestore is likely already non-functional since the rules were tightened (inference, not proven here). The secret still guards `POST /api/bridge`, `tasks` and `chat`.

## 4. Rotation runbook (needs founder approval; do not run until then)

Receivers: Vercel project env `BRIDGE_API_SECRET`; iMac `.env.production.local`; iMac `.env.local` files (2).
Senders: launchd `com.openclaw.bridge-sync` (plist argument), `scripts/bridge-sync*.mjs`, `scripts/sync-pipeline.js`, any operator shell exports.

1. Generate a new random value (32+ bytes) in the founder's password manager. Never paste it into chat or a commit.
2. Merge this PR (and PR #78) first, so no browser path depends on the old value.
3. Move the launchd sender off argv: change the plist to read `BRIDGE_API_SECRET` from an `EnvironmentFile`-style wrapper script or from the macOS Keychain, so the value is not in `ps`. Test with `launchctl print` after, without restarting production processes.
4. Update the receiver first, then senders: set the new value in Vercel (all environments) and in the iMac `.env.production.local`; redeploy Vercel.
5. Update the sender (launchd job, scripts) and run one `bridge-sync-once` against the receiver.
6. Verify: `POST /api/bridge` with the OLD value returns 401; with the NEW value passes the gate (use a no-op payload); `GET /api/bridge/tasks` without a session returns 401.
7. Delete the old value from both iMac `.env.local` files and any shell history or notes.
8. Rollback: keep the old value available for one hour; if senders fail, re-set the previous value on the receiver only, fix the sender, rotate again. Do not weaken the check.

## 5. Founder-only actions

Approve rotation; perform steps 1, 4, 7 (secret handling); approve any change to Firestore rules (none is required by this finding: the deployed rules are already restrictive).
