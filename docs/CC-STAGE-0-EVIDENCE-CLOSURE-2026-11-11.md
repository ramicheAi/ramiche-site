# Parallax OS Command Center Stage 0 evidence closure

**Date:** 2026-11-11  
**Scope:** read-only evidence and architecture closure for draft PR #76  
**PR baseline:** `9016d991f0ea2b022d7c65f5c695ef379360c2aa`  
**Decision:** Stage 0 remains **NO-GO for closure**. The active origin and existing project-state publishers are now identified, but the deployed artifact is not traceable to an immutable clean Git tree, the Cloudflare Access policy and authenticated claim contract remain unavailable, and real-device mobile lifecycle acceptance is still blocked.

No merge, deploy, runtime implementation, policy change, database write, migration, credential change, or production data mutation occurred.

## 1. Source-backed evidence ledger

| ID | Classification | Finding | Source and read-only method | Decision impact |
|---|---|---|---|---|
| S0-E01 | Observed | `command.parallaxvinc.com` is served through Cloudflare Access. An unauthenticated request returns 302 to `calm-firefly-c94b.cloudflareaccess.com`. | Public HTTP response on 2026-11-11. The signed redirect payload was not retained. | Preserve Access as the perimeter. |
| S0-E02 | Observed | The Access application audience is `ca9374cc7db56c1e4b809f07d460f7ba1ef67c84a534470ee6687656ff0c1de5`. The team domain and issuer base are `https://calm-firefly-c94b.cloudflareaccess.com`. | Public Access redirect metadata and `/.well-known/cloudflare-access-protected-resource/command-center`. | Audience and issuer inputs are known, subject mapping is not. |
| S0-E03 | Observed | The Access JWKS endpoint is public at `https://calm-firefly-c94b.cloudflareaccess.com/cdn-cgi/access/certs` and returned RS256 signing keys. No key material or token was copied into this repository. | Public JWKS response on 2026-11-11. | Verifier discovery endpoint is known. Key rotation must remain dynamic. |
| S0-E04 | Observed | The active Cloudflare Tunnel is `command-center`, tunnel ID `2bbb32b5-e281-4677-a4f7-7435dca76830`. Its ingress sends `/webhooks/*` to local port 9876 and all other `command.parallaxvinc.com` paths to `http://127.0.0.1:3000` on the iMac. | Read-only inspection of `/Users/admin/.cloudflared/config.yml` over the fleet SSH connection. Credential path was redacted. | The active production origin is the iMac local Next.js process, not the PR Preview and not the known Vercel alias. |
| S0-E05 | Observed | Launch agents `com.command-center-tunnel` and `com.command-center` are running. The tunnel process and Next server have been running since 2026-10-29. | Read-only `launchctl` and process inventory on the iMac. | Confirms current topology and process continuity. |
| S0-E06 | Observed | The origin checkout is `/Users/admin/ramiche-site` on branch `simplify/cc-retire-unused`, HEAD `cabe7180e7ecd392707134c1c6dc4bca519cee4f`, with many tracked modifications and untracked files. | Read-only Git status, branch, HEAD, and commit metadata on the iMac. | `cabe7180...` is a checkout HEAD candidate only. It is not an immutable deployed revision because the built tree is dirty and cannot be reconstructed from Git. CC-BDR-001 is only partially closed. |
| S0-E07 | Observed | The local origin redirects `/command-center` to `/command-login` and returns 401 for `/api/command-center/projects` without the portal credential. | Safe loopback GET requests on the iMac. | The second portal credential is still active behind Access. |
| S0-E08 | Observed | The known direct Vercel alias `ramiche-site.vercel.app` returns 404 for the Command Center page and Projects API, including when fabricated Access headers are supplied. | Safe unauthenticated negative GET requests using a nonexistent email and invalid JWT. | This known alias is not a working bypass. This does not prove that no other origin hostname exists. |
| S0-E09 | Blocked | Vercel team metadata remains inaccessible. The connector returns 403 for team `ramicheais-projects`. | Read-only Vercel project listing attempt. | Do not use Preview metadata as production evidence. Vercel inspection is optional unless another origin or preview target is placed in scope. |
| S0-E10 | Blocked | Cloudflare dashboard access is not authenticated in the available browser session. Policy order, identity providers, application session duration, device posture, bypass rules, service-token rules, and authenticated claim samples were not inspected. | Browser stopped at Cloudflare dashboard login. | CC-BDR-002 remains blocked. Public metadata cannot substitute for the policy export or redacted authenticated claim sample. |
| S0-E11 | Observed | The chat client does not persist or restore the active channel. On mount it chooses the first returned channel or hardcoded `#mettle`. | `src/app/command-center/chat/page.tsx`, mount load effect and channel selection. | Closing and reopening cannot reliably restore Content Team. |
| S0-E12 | Observed | The message read calls Supabase directly from the browser, reads only `data`, does not inspect `error`, and exposes no unavailable state. A denied read therefore becomes an empty timeline. | `src/app/command-center/chat/page.tsx`, active-channel message load effect. | The reported “lost” history is reproducible as a presentation failure without deleting or changing a production row. |
| S0-E13 | Blocked | A same-device authenticated mobile trace was not captured. The available browser session redirected to Cloudflare login, and no credentials were requested or changed. | Safe browser navigation only. | The exact contribution of denied reads versus wrong-channel restore on the reported phone remains unknown. Real iPhone Safari/PWA acceptance is still required. |
| S0-E14 | Observed | RAMICHE OS owns a versioned project registry under `registry/projects/*.json`, task/outcome/evidence/receipt schemas, a read-only board projector in `bin/cc_board.py`, and a journal adapter in `bin/journal_activity.py`. | Read-only source inspection of `ramicheAi/ramiche-os`. | Stage 4 must consume or adapt these contracts. It must not create a second project truth model in `ramiche-site`. |
| S0-E15 | Observed | The shared journal is explicitly self-reported and unverified. Its adapter must not change project status, blockers, verified counts, or integration level. | `bin/journal_activity.py` contract. | Journal activity is supporting evidence only, never canonical project status. |
| S0-E16 | Observed | A strict structured journal record format exists in `bin/journal_writer.py`, but its own contract says it does not replace the live writer and migration requires separate approval. | `bin/journal_writer.py` contract. | Do not make this proposed writer the Stage 1 or Stage 4 dependency. Treat activation as a separate RAMICHE OS decision. |
| S0-E17 | Observed | The iMac `com.openclaw.bridge-sync` daemon is running and attempts 11 collections once per minute, but every recent collection push fails with HTTP 401. | Read-only process inventory and redacted bridge logs. | The bridge is running but nonfunctional. It is not a live publication source. |
| S0-E18 | Observed | Despite 0/11 successful collection pushes, `public/status.json` advances `lastSync` every minute and labels agents idle. | Read-only `public/status.json` plus bridge log comparison. | This is a confirmed false-freshness contract. The projector may not use `lastSync` as proof that collections were accepted. |

## 2. Architecture decisions ready for founder acceptance

1. **Accept the active-origin topology:** Cloudflare Access and Tunnel terminate at the iMac Next.js service on `127.0.0.1:3000`. Vercel Preview is not production.
2. **Accept the clean-artifact requirement:** no enforcement change is allowed until production is built from a clean, immutable revision and the runtime exposes that revision in a non-secret health response or signed deployment receipt.
3. **Accept the Access verification inputs already proven:** exact audience, team-domain issuer base, and dynamic JWKS discovery endpoint. Do not accept a subject mapping until a redacted authenticated human assertion proves stable `iss`, `sub`, `aud`, identity type, and any role/group claims.
4. **Accept RAMICHE OS as the project publication owner:** `registry/projects`, structured task/outcome/evidence/receipt records, and the board projector are the canonical contract candidates. The shared journal is supporting activity only.
5. **Reject the current bridge as live truth:** a process that reports 0/11 accepted collections and advances `lastSync` is unavailable, not LIVE.
6. **Accept the mobile defect contract:** restoring the last authorized conversation and distinguishing denied, unavailable, empty, and stale states are Stage 2 requirements, with lifecycle acceptance repeated at every later stage.

## 3. Outstanding blockers

- Export or inspect the Cloudflare Access application and ordered policies read-only. Record application session duration, allowed identity providers, device posture, bypass/include/exclude rules, service-token policy, and whether any path bypass exists.
- Capture one authenticated Access assertion at the origin through an approved redacting diagnostic. Retain claim names and non-sensitive shapes only. Do not retain the raw JWT, email, name, groups, or token identifiers.
- Replace the dirty long-running production artifact with a separately approved clean deployment process before claiming an immutable deployed SHA. Stage 0 may document the requirement, but does not authorize that deployment.
- Run same-device and cross-device acceptance on a real iPhone Safari or installed PWA after authenticated test access is available. No production message needs to be sent. Existing Content Team rows can be read and their identifiers/content redacted from the artifact.
- Reconcile the bridge secret or receiver authorization only in a separately approved implementation task. Stage 0 records the 401 failure but does not change credentials.

## 4. Exact proposed Stage 1 authorization boundary

**Permitted only after separate founder approval:**

- implement a server-side Cloudflare Access assertion verifier using the proven issuer base, exact audience, and dynamic JWKS;
- add principal mapping and a short-lived HttpOnly application session in shadow mode;
- add authorization middleware, CSRF protection, redacted audit receipts, and disabled-by-default break-glass scaffolding;
- add invalid, expired, wrong-issuer, wrong-audience, missing-subject, service-token-confusion, and replay tests;
- add mobile lifecycle acceptance for Access return, background/foreground, reload, browser restart, and session expiry at 390px plus a real phone canary;
- keep the current PIN path available for rollback until the SSO canary is separately accepted.

**Not permitted by Stage 1 approval:**

- no Cloudflare policy, tunnel, DNS, session-duration, bypass, or identity-provider change;
- no production enforcement, removal of the PIN, merge, deploy, credential edit, database migration, schema change, public grant, or production data write;
- no chat BFF, project reconciler, bridge repair, mobile redesign, or unrelated feature work;
- no trust in caller-supplied identity headers, email alone, or unverified service-token identity.

## 5. Go and no-go criteria

### Stage 0 GO for closure

- active origin and a reproducible immutable deployed revision are both recorded;
- direct-origin reachability is enumerated and every known direct path denies Command Center access without the intended perimeter and application authorization;
- Cloudflare Access policy export and redacted human claim shape are reviewed;
- service-token and bypass rules are explicitly separated from human identity;
- RAMICHE OS field ownership and bridge failure behavior are accepted;
- mobile defect reproduction has a captured test artifact and a real-device acceptance plan;
- founder accepts the six architecture decisions above.

### Current result

**NO-GO.** Active origin, Access audience/issuer/JWKS, project contract ownership, bridge status, and the deterministic chat failure are established. Immutable deployed revision, Cloudflare policy/claim evidence, exhaustive origin-bypass proof, and authenticated real-device lifecycle evidence remain blocked.

