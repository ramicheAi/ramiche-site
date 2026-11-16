# Command Center acceptance — findings

Run at base `f4287176` (origin/main), harness branch `deepseek/cc-staging-01`.
Every item below was observed in a browser against the real application, with the evidence artefact
named. Nothing here is inferred from reading code alone.

## Fixed in this branch

### 1. Every Command Center page load returned HTTP 500 from briefing compose

`POST /api/command-center/briefing/compose` failed on **every page load**, so the Atlas briefing
could only ever show its deterministic fallback.

Reproduced with the client's own payload:

```
POST /briefing/compose  status=500
{"facts":{"now":"2026-11-16T20:36:50.650Z", ...}}
server: TypeError: h.getHours is not a function
        at src/lib/cc-briefing.ts:110
```

`composeBriefing` typed `now` as `Date`, but the value arrives over JSON, where a `Date` is a string.
The route passed the request body straight through, so `now.getHours()` threw. The panel still showed
text, which is exactly why this survived: the fallback looks like success.

Fixed in `src/lib/cc-briefing.ts` by accepting `Date | string` and normalising, with
`src/lib/cc-briefing.test.ts` covering ISO strings, a real `Date`, and garbage that must not throw.
Verified: the same request now returns `200` with `source: "atlas"`, and the harness re-ran green.

## Found, not fixed (outside this mission's isolated scope)

### 2. A gateway failure is shown to the operator as raw upstream JSON

Evidence: `artifacts/<run>/G-01-backend-error.png`.

When the gateway returns a non-2xx with a JSON body, the chat bubble renders that body verbatim:

```
{"ok":false,"error":"e2e injected gateway failure"}
```

The operator gets machine output where a sentence belongs. The relay side is correct (state recorded
`unknown`, not `delivered`); only the message is wrong.

### 3. The synthesis card has no reject control

Evidence: `D-01-synthesis-card.png`; the journey reports `approve=true reject=false`.

The card can only be approved. The mission asks for approve **and** reject as separate tests; reject
is `BLOCKED` because no affordance exists. This is a product gap, not a harness gap.

### 4. The classic console workflow does not exist at its route

Evidence: `H-01-legacy.png`.

`/command-center/legacy` renders the v6 mission-control dashboard. `src/app/command-center/legacy/page.tsx`
still contains a live-chat composer (`input[placeholder^="Message an agent"]`), and the element is
present and accepts text, but pressing Enter clears the input and issues **no request** to either
`/api/bridge/chat` or `/api/command-center/chat`. Journey H is `BLOCKED` with that reason rather than
recorded as a pass or a silent failure.

### 5. The SEND control is below the touch-target minimum on mobile

Evidence: `M-02-mobile-sent.png`; measured `62x29 px` at a 390x844 viewport against the 44x44
minimum. Layout, overflow and message rendering are otherwise correct on mobile.

### 6. A failed attachment upload is silent, and the message still sends

Observed in the first full run, before attachment storage was emulated for the harness
(`artifacts/2026-11-16T20-26-01-625Z/B-01-attachment.png`, persisted row `attachments: []`).

With storage returning 500, the composer still attached the file, sent the message, and the UI showed
`[image: e2e.png]`. The stored row had an **empty** attachments array. The operator is shown an
attachment that was never stored. Once the harness provided storage, journey B passed and the
attachment URL persisted, which isolates the defect to the upload-failure path.

## Environment limitations (not defects)

- **Realtime is absent by design in the harness.** The app surfaces `REALTIME ERROR` / `REALTIME
  TIMEOUT` and every journey still completes through the documented polling fallback. That is
  resilience evidence, not an outage.
- **The app's CSP refuses browser-side Supabase calls to a non-`*.supabase.co` origin.** Server
  routes are unaffected. Counted separately, never folded into "no errors".
- **`next dev` never hydrates on this machine** (Next 16.3.8 / Node 26): HTML is served, React never
  attaches. The harness runs the production build with `--webpack`; Turbopack cannot build here
  (missing `@vercel/turbopack/postcss`).

## Harness defects found and fixed while building it

Recorded because each one produced a *wrong* result before it was fixed:

1. Fake PostgREST returned arrays where `.single()` expects an object, which made a working send look
   like a persistence failure.
2. Counting every gateway tool call as an agent turn counted `agents_list` (a directory read) as a
   duplicate dispatch. Counting is now limited to `sessions_send`/`sessions_spawn`.
3. After the briefing fix, the briefing's own gateway call looked like a duplicate turn. The gateway
   call log is now cleared immediately before each measured action.
4. Journey H initially **passed** while matching a reply string with zero dispatches. A reply now
   only counts when a dispatch happened.
5. A stale stack on the app port let `waitFor` succeed against the wrong build. `boot.mjs` now
   refuses when any of its three ports is already owned.
6. `node_modules` was a symlink into another checkout, which broke client hydration entirely. It is a
   real directory in this worktree now.
