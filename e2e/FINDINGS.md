# Command Center acceptance — findings

Baseline `f4287176`, harness branch `deepseek/cc-staging-01`. Every item was observed in a browser
against the real application; the artefact is named for each.

## Fixed in this round (CC-ACCEPTANCE-02)

### A. A failed attachment looked attached, and the message sent anyway (P1)

Before: the upload result was discarded (`if (j.url) uploads.push(...)`), so a 500 from storage left
`uploads` empty while the screen still showed the filename. The message dispatched with
`attachments: []` and content containing `[Image: e2e.png]`.

Now: an attachment has an explicit state (`uploading` → `ready` | `failed`), shown on the chip as
"Uploading…", "Stored" or "Not stored". Uploads start when the file is attached, so a failure is known
while the operator is still typing. A failed or in-flight attachment **blocks the send**, the composer
says why, and offers two explicit escapes: **Retry** the upload, or **Send without attachments**
(which drops the file deliberately and sends text only). Only `ready` attachments with a stored URL
are persisted, and the harness compares the persisted URL against the uploaded object path.

Regression coverage: `src/lib/chat-attachment-state.test.ts` (8 cases: success, uploading, failed,
ready-without-url, retry-then-ready, removal, partial failure count, labels) plus journey **B2** which
drives the real UI through failed → blocked → retry → stored → sent, and failed → text-only → sent.

Evidence: `B2-01-failed-chip.png`, `B2-02-blocked.png`, `B2-03-retried.png`,
`B2-04-sent-after-retry.png`. Before: `B-01-attachment.png` in the CC-STAGING-01 run.

### B. The classic console's composer was dead (P1)

Before: `/command-center/legacy` rendered the v6 mission-control dashboard, and its "Message an agent"
composer accepted text and produced **no request at all**. Typing into it looked like sending.

Now: the composer is removed rather than rebuilt (restoring the legacy console is a product decision,
not a defect fix). The screen states that messaging is not connected here and links to
`/command-center/chat`, and the historical message list is untouched. Journey **H** asserts no
composer input exists, the explanation is present, and the link exists.

Evidence: `H-01-legacy.png`.

### D. Gateway failures were shown as raw upstream JSON

Before: `{"ok":false,"error":"e2e injected gateway failure"}` was rendered verbatim in the chat
bubble.

Now: a failure is one sentence, with a short **reference** and honest guidance. A 4xx says a retry
will not help; a 5xx says it might. The raw body is logged server-side with the same reference, so an
engineer can still see it and the operator cannot. The sanitiser also redacts bearer credentials,
key-shaped tokens, long hex blobs and filesystem paths, so a gateway that echoes a secret or
`/Users/admin/...` cannot leak it to the screen.

Regression coverage: 7 new/updated tests in `src/lib/openclaw-gateway.test.ts` (raw JSON never
rendered, status-only sentence, 4xx vs 5xx guidance, bearer/token/path redaction). Journey **G**
asserts no `{"ok":false` in the page and a `Reference xxxxxxxx.` present.

Evidence: `G-01-backend-error.png` — now reads
"e2e injected gateway failure Reference fb3cf223. Try again in a moment."

### E. The mobile SEND control was 62x29 px

Now 62x44 (min-width/min-height 44 with padding, not type size). Measured at **320, 390 and 1440**:
all three are 62x44, and horizontal overflow is 0 at all three. Journey **M** fails if any width
drops below 44x44 or overflows.

Evidence: `M-02-mobile-sent.png`.

## Blocked: rejection has no contract (P1, product decision)

There is no rejection anywhere in the backend. The only terminal state on a synthesis row is
`metadata.approved_at`; no route writes a rejected/declined state, and `describeDuplicate` has no
notion of one. Journey **D2** is **BLOCKED** rather than passed, and no card is hidden to simulate it.

Minimum safe change, if rejection is wanted:

1. `POST /api/command-center/chat/approve` accepting `{ messageId, decision: "reject" }`, owner-gated
   by the same `ownerOnly` wrapper.
2. Write `metadata.rejected_at`, `metadata.rejected_by` and `metadata.resolution = "rejected"` in one
   update, `.select("id")` so a zero-row write is visible.
3. Make the relay claim's terminal set include the rejected state so a rejected synthesis can never
   be dispatched later, and make `describeDuplicate` report it as terminal.
4. A card control with the same confirm affordance as Approve, and a test that a rejected plan never
   dispatches an agent turn.

That is a feature with a state machine, not a defect fix, so it needs founder authorization.

## Remaining, not fixed (reported)

- **The briefing panel still fails when the gateway is down.** Fixed earlier this round (the 500), but
  the deterministic fallback is what the operator sees; there is no visible indication that the
  LLM-composed briefing is unavailable rather than absent.
- **`agents/manage` model picker** still mutates local state only (pre-existing, different screen).

## Harness defects found and fixed this round

1. The fake's storage control endpoint was never actually registered (a duplicated reset block hid
   it), so the first failure-mode test silently uploaded successfully.
2. `force: true` on the text-only control defeated Playwright's enabled-wait, so the click landed on a
   disabled button and looked like a product failure.
3. A journey asserted exact content equality while the UI appends an attachment marker, and another
   pinned `status === "sent"` when mark-read legitimately advances it to `"read"`.
