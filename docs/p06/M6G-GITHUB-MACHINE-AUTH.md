# P06 M6G: the executor's own GitHub identity (no Keychain, no prompt)

## Why
The executor's remote-head check (the stale-head protection every run needs) used `git ls-remote` with the macOS
Keychain credential helper. In the founder's GUI session that read waits for a Keychain approval dialog, so an
unattended host hangs. The fix is a machine identity that never involves a person's credential or the Keychain UI.

## Design
- **Identity:** a GitHub App, "Parallax Executor ramicheAi", owned by the `ramicheAi` user. It has no webhooks.
- **Permissions:** Contents: read and Metadata: read, nothing else.
- **Installed on:** only `ramicheAi/mettle` and `ramicheAi/ramiche-site`. Add a repository only when a run needs it.
- **Flow** (`src/lib/execution/github-app.ts`), run by the trusted executor before Claude starts:
  1. The App key signs a JWT (RS256, valid 9 minutes).
  2. That JWT mints an installation token scoped by request to the ONE repository being checked, with contents/metadata read.
  3. The response is checked, not trusted. Any other permission or repository is refused and the token is revoked.
  4. One REST read: `GET /repos/{owner}/{repo}/git/ref/heads/{branch}`.
  5. The token is revoked. (It expires within the hour anyway.)
- **No git involved:** no credential helper, no remote URL, no `.git/config`, no child process.
- **Fail closed:** each request has a 10 second limit. A missing configuration, a slow or failing GitHub, or an over-broad grant all produce `BLOCKED · GitHub machine authentication unavailable` (code `github_auth_unavailable`) in prepare, in the executor (before any record, worktree or CLI), and in health. There is no fallback: the Keychain `ls-remote` path was deleted.
- **Secret storage:** `pvault` (login Keychain master), routed into the cockpit's 0600 env file. The cockpit reads three variables: `PARALLAX_GITHUB_APP_ID`, `PARALLAX_GITHUB_APP_INSTALLATION_ID` and `PARALLAX_GITHUB_APP_PRIVATE_KEY_B64`. The service never reads the Keychain at run time.

## Threat model
| Threat | Control |
|---|---|
| Token or key in logs, results, errors | Errors carry status codes only; tests assert the token and key never appear in results, messages or stacks |
| Claude Code sees the credential | `executionEnv` is an allowlist (PATH, HOME, USER, ...): App settings and any `GITHUB_TOKEN`/`GH_TOKEN` are never passed (tested). The read happens before Claude starts; L0/L1 tools are Read/Glob/Grep inside the worktree only, so the cockpit env file is unreadable to it |
| `.git/config` / remote URL persistence, shell history | No git is used for the read; the token is never written anywhere or typed into a shell |
| Process inspection | The token lives only in the cockpit process's memory for one request, in an HTTP header, never in argv or a child's environment |
| Repo-controlled scripts, compromised worktree | Nothing from the repository runs during the check; the check is a REST call by the trusted executor |
| Token reuse / expiry | One token per check, scoped to one repository, revoked after use; GitHub expires it within an hour regardless |
| Wrong repository | The token is requested for the exact registry repository and the response's repository list must equal it; the checkout's origin is verified separately |
| Wrong installation | The installation id is fixed in configuration; `check` verifies the installation's permissions and repository list |
| Write authority | The App has only read permissions; GitHub refuses to mint write tokens (`check` proves it, non-destructively) |

## Setup (once; GitHub only lets the account owner create and install an App)
Run on a machine with a browser signed in to GitHub as `ramicheAi`:
1. `node --experimental-strip-types scripts/m6g-github-app-setup.mjs create`.
   - Open http://127.0.0.1:8719 and press **Create GitHub App** on GitHub's page.
   - The App id and key go to `~/.parallax/github-app/executor.env` (0600). They are never printed.
2. Install it from the printed link on ONLY `ramicheAi/mettle` and `ramicheAi/ramiche-site`.
3. `node --experimental-strip-types scripts/m6g-github-app-setup.mjs finish` records the installation id.
4. `pvault import-env ~/.parallax/github-app/executor.env ...` stores the values in the vault and routes them to the cockpit's env file on the iMac.
5. Acceptance, from the executor's own context: `... m6g-github-app-setup.mjs check --secrets-file <cockpit env file>` must print `M6G CHECK: PASS`. That needs both remote heads read, read only, write tokens refused, and bounded time.
