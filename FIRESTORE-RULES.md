# Firestore rules for the shared project

This repo does not carry or deploy Firestore security rules.

The Parallax site, METTLE and Galactik Antics all use one Firebase project. A
Firebase project has exactly one live Firestore ruleset, and the last
`firebase deploy` wins. Several repos used to hold their own copy of the rules,
so a deploy from any of them could silently replace the live ruleset with an
older or different one.

## The policy

- The rules live in, and deploy only from, `ramicheAi/mettle` (`firestore.rules`).
  That repo has the live-emulator rules test suite.
- This repo contains no `firestore.rules`, no `.firebaserc`, and no
  `firebase.json` with a `firestore` key. `src/lib/no-firestore-rules-deploy.test.ts`
  fails if any of them comes back.
- Nothing here depends on those files to run. The app uses the Firebase client and
  Admin SDKs only.

## Proposing a rules change from here

Open a PR against `ramicheAi/mettle` that edits `firestore.rules` and extends its
emulator rules tests. Do not edit or deploy rules from this repo.
