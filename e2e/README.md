# Command Center acceptance harness

Drives the real Command Center in a real browser against synthetic external services, and asserts on
**what the operator sees** and **what the backend recorded**, together. A journey does not pass
because a spinner stopped.

```
e2e/
  boot.mjs                 starts the synthetic stack (refuses to start if it could reach production)
  run.mjs                  the journeys, the assertions, the screenshots, the results
  support/fake-supabase.mjs  in-memory PostgREST subset + the relay claim/mark RPCs + attachment storage
  support/fake-gateway.mjs   OpenClaw /tools/invoke stub, with ok | slow | error | noreply modes
  support/auth.mjs           mints the synthetic trusted-device cookies the real guard verifies
  artifacts/<run>/           results.json, screenshots, traces
```

## Why it is built this way

There is no Docker on this machine, so a local Supabase stack (`supabase start`) is unavailable, and
there is no Firebase emulator. Rather than mock the application, only the **external** services are
faked:

- the **real Next build** runs (`next start`),
- the **real route handlers** run (chat, persistence, approve, upload, relay claim),
- the **real owner guard** runs, satisfied through its **real trusted-device path**: a synthetic
  device row in the synthetic database plus cookies signed with a local secret. No auth bypass, no
  production code change,
- only Supabase (PostgREST, storage) and the OpenClaw gateway are stubs.

**`next dev` never hydrates the client on this machine** (Next 16.3.8, Node 26): the server renders
HTML, `window.next` initialises, and React never attaches, so every browser journey would pass or
fail for the wrong reasons. The harness therefore builds and runs the production output with
`--webpack` (Turbopack cannot build this app here: it needs `@vercel/turbopack/postcss`). This is
recorded because it is easy to mistake for an application bug.

## Evidence classes

Every result carries one, and the report never upgrades one into another:

| class | means |
|---|---|
| `integrated` | real UI → real route handler → real relay claim → fake external service. Proves the application's own logic end to end, over real HTTP. |
| `simulated` | a stub answers without the application's code running. Proves rendering, nothing more. |
| `real-device` | **none exist yet.** Nothing here was run on hardware. |

An attached-file journey that passes here proves the app uploaded, stored and persisted a reference.
It does **not** prove a real agent read it.

## Isolation

`boot.mjs` refuses to start when:

- any `*SUPABASE*`, `*OPENCLAW*`, `*FIREBASE*`, `*VERCEL*`, `*PARALLAX*` variable points at a hosted
  service (`supabase.co`, `firebaseio.com`, `openclaw.ai`, `vercel.app`),
- `VERCEL` is set, or `NODE_ENV=production`,
- anything already owns the three ports (a stale stack would let a run pass against the wrong build).

Two of the fakes additionally refuse to bind if they see a hosted URL. Journey **Z** proves the
refusal by launching the boot with a fake production URL and requiring a non-zero exit.

## Run it

```bash
# 1. build (production output; dev does not hydrate here)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon \
SUPABASE_SERVICE_ROLE_KEY=e2e-service \
PARALLAX_OWNER_UID=e2e-owner \
CC_UNLOCK_SIGNING_SECRET=e2e-unlock-signing-secret-0123456789abcdef \
npx next build --webpack

# 2. start the synthetic stack (foreground; prints READY=<url>)
node e2e/boot.mjs

# 3. in another shell, run the journeys
node e2e/run.mjs                 # all
node e2e/run.mjs --only A,E      # a subset
```

Stop a stale stack before re-running:

```bash
pkill -f "e2e/support/fake-supabase"; pkill -f "e2e/support/fake-gateway"; pkill -f "next start"
```

## Matrix (last run)

| id | journey | class | result |
|---|---|---|---|
| A | Send a message, receive the agent response | integrated | PASS |
| B | Send a message with an attachment | integrated | PASS |
| B2 | Failed upload blocks the send; retry and text-only paths | integrated | PASS |
| C | Reload and recover the conversation | integrated | PASS |
| D1 | Approve a synthesis request | integrated | PASS |
| D2 | Reject a synthesis request | — | BLOCKED: no rejection contract exists in the backend |
| E | Duplicate clicks do not duplicate execution | integrated | PASS |
| F | Lost acknowledgment, then retry | integrated | PASS |
| G | Backend failure produces actionable feedback | integrated | PASS |
| H | Classic console: composer retired, points at working chat | integrated | PASS |
| I | Visible delivery state matches backend outcome | integrated | PASS |
| M | 320 / 390 / 1440 layout and touch targets | integrated | PASS |
| Z | Isolation cannot reach a real service | simulated | PASS |

The synthetic Supabase also exposes `POST /__e2e/storage-mode {fail:true}` so the attachment failure
path can be driven through the real UI, and `POST /__e2e/reset` between journeys.

## Known limits of this environment

- **No real agent.** The gateway returns fixed text. Dispatch, claiming, persistence and the rendered
  reply are real; the agent is not.
- **No real Postgres.** The fake implements the PostgREST subset the app uses, including the relay
  claim's lease and terminal-state semantics, in memory. SQL-level correctness is covered by
  `supabase/tests/relay-dispatch-scenarios.sh`, not by this harness.
- **Browser-side Supabase reads are refused by the app's own CSP**, which allows `*.supabase.co` and
  not the synthetic origin. Server routes are unaffected (Node is not CSP-governed), and every
  journey's data path goes through them. Counted as an environment limitation, never as a pass.
- **No realtime.** The fake has no websocket; the app shows REALTIME ERROR/TIMEOUT and the polling
  fallback carries every journey. That resilience is real evidence; the socket is not.
- **Not tested on a device.** No iPhone, no Safari, no iOS keyboard or safe-area behaviour.
