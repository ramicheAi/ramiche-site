# `.parallax-publish-token` was public for eighty days

Date: 2026-11-16. Investigation, containment, and the rotation that still needs the founder's approval. **No secret value appears in this document, this commit, or the PR.** Read-only checks only; nothing was revoked, rotated, or deployed.

## 1. What was exposed

`.parallax-publish-token` sat at the root of `ramicheAi/ramiche-site`, **a public repository**, from 2026-08-28 13:34 -0400 (commit `9e245fd1`) until this branch.

It was not merely in history. It was tracked on `main`, and GitHub serves tracked files without authentication:

| Check | Result |
|---|---|
| `git cat-file -e origin/main:.parallax-publish-token` | present |
| `curl -o /dev/null https://raw.githubusercontent.com/ramicheAi/ramiche-site/main/.parallax-publish-token` | **HTTP 200, 1006 bytes** |
| Repository visibility | `public`, enabled since 2026-02-05 |
| Forks | 0 |
| Exposure window | 80 days, continuous |

The file also carried a header comment explaining itself. It said the token "can live in a private repo." That was true of the *other* repositories holding it. This one is public, so the premise the safety argument rested on was false — and no comment can enforce a premise.

## 2. What the token can do (and cannot)

It is a Parallax Publish **queue-only** token, not a publishing credential.

| Property | Value |
|---|---|
| Name | `cloud-ramiche` |
| Prefix in the app's own display | `pxp_que_uuAM...` |
| Scope | `queue` — **cannot publish** |
| Brand | `ramiche` only |
| Workspace | bound at mint; cannot name another |
| Revoked | **no — active** |
| Last used | **never** |

A `queue` token submits to an approval queue and a human approves. It cannot post to a live account, cannot reach another brand, and cannot reach another workspace. `SERVICE_TOKEN` — the full publish credential — was **not** in this file and is not exposed by this repo.

## 3. Unauthorized activity: none found

| Signal | Result |
|---|---|
| `AgentToken.lastUsedAt` for this token | `NULL` — never resolved |
| `QueuedPublish` rows attributed to this token | **0** |
| Queue rows in the ramiche workspace, last 90 days, any token | **0** |

`lastUsedAt` is written on every successful resolution (best-effort, fire-and-forget), and it is `NULL`, corroborated by zero queue rows. There is no evidence the token was used.

**Stated honestly:** this is evidence of absence, not proof. A caller who never successfully queued anything leaves no `QueuedPublish` row, and the bookkeeping write is not transactional. Absence of evidence here is genuinely reassuring but not a guarantee, which is why rotation is still required.

## 4. Blast radius if abused

Bounded, but not zero:

- **Queue spam aimed at real accounts.** Brand `ramiche` has 6 accounts across 5 platforms, so an attacker could enqueue content targeting Ramon's live accounts and rely on approval fatigue. No rate limit exists on `POST /api/service/queue`.
- **Approval-screen injection.** Caption, `agentName`, and note are attacker-controlled and rendered for the approver.
- **Server-side fetches of attacker URLs.** `checkPublicMediaUrl` fetches submitted media on the server. It is SSRF-guarded (https only, public-address check per hop, hop cap, 12s timeout), so this is bandwidth/amplification, not a pivot.

It cannot publish, cannot reach another brand, and cannot read another workspace's queue.

## 5. Which copies exist, and why only one needs rotation

Four repositories carry a file of this name. They are **different tokens**, one per repo, each brand-scoped:

| Repository | Visibility | Token name | State |
|---|---|---|---|
| `ramiche-site` | **public** | `cloud-ramiche` | **exposed — rotate this one** |
| `parallax-site` | private | `cloud-parallax` | fine |
| `mettle` | private | `cloud-mettle` | fine |
| `scoww` | private | (not checked out here) | presumed fine |

Rotating `cloud-ramiche` costs nothing else: it is a separate credential from the other three, and no other repo depends on it.

## 6. What this change does

1. `.parallax-publish-token` is removed from tracking and deleted, and `.gitignore` now lists it.
2. `scripts/publish-creds.mjs` no longer reads a file from the tree. It reads `PARALLAX_PUBLISH_TOKEN` from the environment, and says so plainly when it is absent instead of pointing sessions at a committed file.
3. `scripts/no-committed-credentials.test.mjs` fails the suite if git tracks a credential-shaped filename, if the ignore rule disappears, or if the helper regains a file fallback.

Removal from `main` is **not** the fix. The value is in history, in every clone, and in any cache in front of GitHub. **Rotation is the fix**; removal only stops the bleeding.

## 7. Founder action required (not executed)

### 7.1 Revoke the token — required

In `parallax-publish`:

```
npx tsx scripts/agent-token.ts revoke cloud-ramiche
```

Verify: `npx tsx scripts/agent-token.ts list` should show `cloud-ramiche ... REVOKED`.

Then confirm a call with the old value returns 401:

```
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://parallax-publish.vercel.app/api/service/queue \
  -H "authorization: Bearer <old value>" -H 'content-type: application/json' -d '{}'
```

Expect `401`. A `400` means the token still resolved and the body was merely rejected — re-read section 3.

### 7.2 Mint a replacement and inject it — required before containers lose the queue path

This change removes the file fallback, so any container relying on it will report "no queue token" until the value is injected.

1. Mint a replacement: `npx tsx scripts/agent-token.ts mint cloud-ramiche-2 --brand ramiche`
2. Store it in the founder's password manager. Do not paste it into chat, a commit, or a doc.
3. Inject it as `PARALLAX_PUBLISH_TOKEN` wherever the old file was being read. Never as a commit.

### 7.3 History rewrite — optional, founder's call

The value remains in history from `9e245fd1` onward. Once revoked it is inert, and a rewrite costs every clone and every open PR. Recommended only if you also intend to reduce the count of stale secrets in history. `git filter-repo --path .parallax-publish-token --invert-paths` plus a forced push, coordinated with Claude's in-flight branches, which this repo has many of.

## 8. Why GitHub did not catch it

`secret_scanning` is **enabled** on this repository; `secret_scanning_non_provider_patterns` is **disabled**, and `secret_scanning_validity_checks` is **disabled**.

The token uses a private `pxp_que_` prefix. GitHub's provider patterns cover known vendors, so a custom prefix only matches when non-provider patterns are on. That toggle is worth enabling across the org: it is the difference between catching this at push time and reading about it eighty days later.

## 9. The general lesson

A credential's safety argument is a property of **where it is stored**, not of what it can do. "Queue-only, brand-scoped, cannot publish" made this token low-severity — it did not make it safe to publish. Low severity is not no severity: it was enough to spam an approval queue aimed at live accounts.
