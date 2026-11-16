# CC-RECOVERY-21 — real-device acceptance plan for Command Center

**Status: plan only. No deployment has happened yet, so none of this can be run for real today.**
This exists to be picked up the moment a real deployment ships PRs #100/#101/#103/#105 (and,
once reviewed, #106/#104) and the two migrations are applied per
`CC-RECOVERY-21-MIGRATION-DEPLOYMENT-SEQUENCE.md`.

## The distinction this document exists to keep

A passing `vitest` suite proves a function behaves correctly given the inputs a test constructs.
It does not prove a real browser, on a real phone, on a real network, driven by a real finger,
produces those inputs — or that the response renders the way a person actually reads it. Every
item below is tagged:

- **[CODE]** — already verified by an automated test in this session's work. Listed here only so
  the acceptance pass doesn't re-litigate it; re-verifying it on a device would be redundant, not
  more rigorous.
- **[DEVICE]** — has NOT been run on a real device or browser by anyone in this process. Passing
  the code tests is necessary but not sufficient for these. These are the actual acceptance bar.

## 1. Authenticated chat (main Command Center chat page)

- [CODE] Claim-and-dispatch logic, output-accounting states, lease timing — unit + real-Postgres
  scenario tests (this session, CC-RECOVERY-16 through -21).
- [DEVICE] Sign in on an actual phone (Safari/iOS and Chrome/Android — the owner-only guard and
  session cookie behavior can differ by browser and by whether the session survives backgrounding
  the app).
- [DEVICE] Send a real message, confirm exactly one reply appears, confirm it appears once even if
  the network is slow (no visual duplicate while waiting).
- [DEVICE] Background the app mid-send (lock the phone, switch apps) and return — confirm the UI
  doesn't show a stuck "sending" state forever, and confirm a second tap of Send after returning
  does not double-dispatch.
- [DEVICE] Airplane-mode test: start a send, enable airplane mode immediately, disable it 10
  seconds later — confirm the UI shows a real error state, not a silent hang, and confirm
  resending afterward doesn't produce two replies.

## 2. Retry / replay behavior

- [CODE] `sendCommanderChat`'s and the main page's idempotency-key replay logic — unit tested
  against a mocked persistence route.
- [DEVICE] **This has never been exercised against the real persistence route on a device.**
  Concretely: send a message, the independent reviewer of PR #105 confirmed there is currently
  no real retry UI — so verify what "retry" actually means in practice on the device (does a
  second tap of Send after an error reuse anything, or is it genuinely a fresh message?). If it's
  the latter, that's a known, already-documented gap (see PR #105), not a new finding — but
  acceptance should confirm the ACTUAL behavior matches what's documented, on a real device,
  rather than assuming the code review's conclusion transfers unchanged.
- [DEVICE] Kill and relaunch the app mid-send (not just background it) — confirm the message
  either shows as failed-and-resendable or as delivered, never as a silent gap with no record
  either way.

## 3. Approval cards (synthesis/plan approval flow)

- [CODE] `persisted: false` propagation when the approval's own metadata write fails — unit
  tested (CC-RECOVERY-16).
- [DEVICE] Trigger an approval on a real device and confirm the card visually reflects a
  `persisted: false` state distinctly from a clean success — this session only verified the data
  field exists and is correct; nobody has confirmed what it actually looks like rendered.
- [DEVICE] Tap "Approve" twice quickly (a real double-tap, not a scripted double-call) — confirm
  the UI either disables the button after the first tap or visibly handles the second tap as a
  no-op, not as two plan executions.
- [DEVICE] Telegram approval path: trigger an approval via the Telegram bot on a real phone,
  confirm the callback answer text and the card's Done/not-Done state match what PR #100's fix
  intended (this session verified the message text in a mocked test; nobody has seen the actual
  Telegram UI render it).

## 4. Error recovery

- [DEVICE] Force a 503 from the relay (achievable by testing against a deploy where the migration
  hasn't been applied yet, or by a controlled env flag) — confirm the error message a real user
  sees matches the intended "nothing ran" sentences from `relay-error-message.ts`, not a generic
  error boundary or blank screen.
- [DEVICE] Confirm the app's behavior when the Supabase project is temporarily unreachable
  (simulate by a brief network block if testable) — the code's "fail closed, nothing dispatched"
  design should be visible as a clear message, not a crash.

## 5. Classic console chat

- [CODE] Persist-then-dispatch ordering, replay semantics — unit tested (PR #105, independent
  review confirms correct, but ALSO confirms this has literally never run end-to-end against
  production, since the migration isn't applied there).
- [DEVICE] **Zero device acceptance is possible until the migration ships** — this is the one
  item on this list that is not just "not yet done" but genuinely cannot be done yet. Flagging it
  so it isn't missed once deployment happens: this needs its own explicit device pass, it is not
  covered by "the main chat page works" since it's a structurally different code path
  (`/api/command-center/conversations/:id/messages` then `/api/command-center/chat`, a fixed
  channel id, no history reload wired up per the independent review's note).
- [DEVICE] Confirm whether the lack of a chat-history reload in the classic console (noted by
  the PR #105 review: "the persisted messages never appear in the classic console UI") is
  acceptable as shipped, or needs a follow-up before this counts as done for your purposes.

## 6. Visible execution states

- [DEVICE] Walk through every state `describeDuplicate`/`statusAfterTurn`/`statusAfterEmptyDispatch`
  can produce (`delivered`, `failed`, `unknown`, `failed_permanent`, `legacy`, `in_flight`) and
  confirm each one has a distinct, non-confusing on-screen representation. This session verified
  the states are computed correctly; nobody has confirmed a person looking at the screen can tell
  them apart.
- [DEVICE] Specifically confirm the `unknown` state (CC-RECOVERY-16's main fix) renders as "check
  before resending" rather than looking like an ordinary retryable error — this was the whole
  point of that fix, and it has only been verified in text, never on a screen.

## What this plan cannot do

I have no way to drive a real iPhone or a real browser from here against a deployment that
doesn't exist yet. This document is the checklist for whoever does that pass — likely you, or an
agent with device/browser automation access, once PRs are deployed. Every **[DEVICE]** line above
is an explicit acceptance requirement, not a formality; none of them should be marked done because
the corresponding code test passed.
