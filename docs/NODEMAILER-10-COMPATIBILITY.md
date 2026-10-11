# Nodemailer 10 compatibility evidence

Date: 2026-10-10

Base: PR #62 at `550a0f0c1e46a640ba09574f2143c2377bdd3da2`

## Change under test

- Upgrade `nodemailer` from `8.0.7` to `10.1.0`.
- No route implementation changes.
- Nodemailer 10 requires Node.js 20 or newer. CI already uses Node 20.
- Nodemailer 10 ships TypeScript-based ESM and CommonJS builds. The existing default import typechecks and bundles without source changes.

## Route compatibility

Both sending routes are covered with a mocked transporter. No SMTP connection or live email is used.

- `POST /api/command-center/leads/send`
  - Preserves host, port, secure, and auth transport options.
  - Preserves from, to, subject, text, HTML, and reply-to message fields.
  - Preserves message ID response and lead/event persistence behavior.
- `POST /api/command-center/gate`
  - Preserves the approval-only send path.
  - Preserves from, to, subject, text, and reply-to message fields.
  - Preserves executed status, message ID response, and event persistence.

## Verification

Runtime: Node `20.20.2`, npm `10.9.9`.

- Targeted compatibility tests: 2 passed.
- Full suite: 485 passed, 4 skipped across 53 files.
- TypeScript: passed.
- ESLint: exit 0, 189 existing warnings, 0 errors.
- Clean exact-lockfile install: passed.
- Production build: inconclusive twice. Both clean attempts remained at Next.js `Creating an optimized production build` with no further output for several minutes and were stopped. This matches the previously observed intermittent build stall and is not recorded as a pass.
- Production-only audit after the upgrade: 17 total findings, 4 high. This removes the direct Nodemailer high node from the PR #62 baseline of 18 total and 5 high.

## Remaining risk

- The tests verify the application-facing Nodemailer API and route behavior without sending real email. They do not prove compatibility with the production SMTP provider.
- No credentials were read and no live provider handshake was attempted.
- The four remaining production high nodes are the Firebase, Firestore, and gRPC chain and are outside this patch.
