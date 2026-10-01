# P06 cockpit integration branch

Branch `p06/cockpit-packets123-integration` = the secure cockpit line (`p06/cockpit-secure-line`, commit
`4f4466905795f16356fae2c373223b2018232d1b`, the build the live cockpit runs) plus the six `main` squash commits that
carry Packets 1, 2, 2b, 3 and the P3A supabase changes, cherry-picked in order:

| Order | main commit | Content |
|---|---|---|
| 1 | `d73add0` | Packet 1 agent registry |
| 2 | `ceb8c73` | Packet 2 provider adapter |
| 3 | `6f10aad` | Packet 2b peripheral callers |
| 4 | `63ba642` | Packet 3 execution events (telemetry opt-in via `CC_EXECUTION_EVENTS`) |
| 5 | `c534600` | Supabase CI: no automatic or real `db push` |
| 6 | `fcdf4c6` | Migration history reconciliation (12 migrations) |

Not applied from `main`: the deletion of `/api/yolo-review` (the cockpit keeps its owner-guarded version), and
`/api/test-supabase` and `/api/atlas/chat` stay removed.

## Conflict resolutions
- `chat/webhook/route.ts` (Packet 1): both sides added independent imports. Kept the cockpit's `guardServiceCaller`,
  `UUID_RE` and `sanitizeAttachments` imports and the Packet's `AGENT_DM_UUID` import.
- `leads/kit/route.ts` (Packet 3): the cockpit wraps the generated kit in `humanizeDeep(...)`, the Packet adds a
  `correlation` option. Kept both.
- Eleven other overlapping files merged without conflict. No guard call (`guardProtectedMutation`, `guardPrivateRead`,
  `guardServiceCaller`, owner, CSRF, origin) was removed from any file.

## Test changes (tests only, no production code)
The cockpit moved owner/CSRF/origin guards into the routes (and into `runJob`). The Packet tests exercise provider
behavior, not the guards, so `provider-adapter.test.ts`, `peripheral-callers.test.ts` and `agent-registry.test.ts` now
stub the guards to "owner present" and pass a request where the cockpit signatures require one. The guards keep their
own suites under `src/lib/server/`.
