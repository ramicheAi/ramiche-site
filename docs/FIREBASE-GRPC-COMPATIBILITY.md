# Firebase and gRPC compatibility experiment

Date: 2026-10-10

Base: PR #62 at `550a0f0c1e46a640ba09574f2143c2377bdd3da2`

## Failure chain

The four remaining Firebase-related production high nodes all come from one gRPC advisory chain:

- `firebase@12.19.0`
- `@firebase/firestore-compat@0.4.14`
- `@firebase/firestore@4.17.2`
- `@grpc/grpc-js@1.9.16`

Firestore 4.17.2 declares `@grpc/grpc-js` as `~1.9.0`, which cannot select the patched 1.13.6 or later releases. The existing `google-gax` override protects the separate Firebase Admin dependency path but does not apply to the Firebase client Firestore path.

As of this test, Firebase `13.0.0` is the npm `latest` release and includes Firestore `4.18.0`. Firestore 4.18.0 still declares `@grpc/grpc-js` as `~1.9.0`, so a normal Firebase major upgrade does not remove this advisory chain.

## Isolated experiment

This branch adds an explicit scoped override:

```json
"@firebase/firestore": {
  "@grpc/grpc-js": "1.14.6"
}
```

This is intentionally recorded as a range-crossing override. It is not a claim that the parent package supports gRPC 1.14.6, and it must not be copied silently into PR #62.

Resolved tree:

- Firebase client Firestore: `@grpc/grpc-js@1.14.6` overridden.
- Firebase Admin through `google-gax`: `@grpc/grpc-js@1.14.6` overridden by the existing PR #62 rule.

## Verification

Runtime: Node `20.20.2`, npm `10.9.9`.

- Firebase and Firestore targeted tests: 31 passed.
- Full suite: 483 passed, 4 skipped across 52 files.
- TypeScript: passed.
- ESLint: exit 0, 189 existing warnings, 0 errors.
- Clean exact-lockfile install: passed.
- Production build: inconclusive. It remained at Next.js `Creating an optimized production build` with no further output for several minutes and was stopped. This matches the build stall reproduced on the separate Nodemailer branch and is not recorded as a pass.
- Production-only audit: 14 total findings, 1 high. The Firebase, Firestore, and gRPC high nodes are gone; the remaining high node is direct Nodemailer and belongs to the separate Nodemailer 10 patch.

## Remaining risk

- Unit and build-time coverage cannot prove every wire-level behavior of a range-crossing transport override.
- No emulator or live Firestore calls were made. No credentials, reads, or writes were used.
- Upstream Firestore has not widened its declared gRPC range, including in Firebase 13.0.0.
- This experiment should remain a separate review unit unless stronger emulator or upstream compatibility evidence is accepted.
