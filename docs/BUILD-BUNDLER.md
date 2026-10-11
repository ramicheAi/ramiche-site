# Production build bundler

The default production build uses Next.js Webpack explicitly:

```sh
npm run build
```

Next.js 16 defaults `next build` to Turbopack. On the unchanged P2 safe-audit
baseline at `550a0f0c1e46a640ba09574f2143c2377bdd3da2`, clean Turbopack builds
repeatedly stopped making progress at `Creating an optimized production build`
and exceeded bounded 240-second and 600-second runs. Removing the Sentry wrapper
and bypassing the prebuild and postbuild scripts did not change that result.

Two consecutive clean Webpack diagnostics on the same baseline completed with
exit code 0 in 110.8 seconds and 137.3 seconds. This change selects that supported
Next.js build path while the Turbopack deadlock remains unresolved.

The switch is isolated and reversible. `npm run build:turbopack` retains the
previous production command for bounded diagnostics. Reverting the `build`
script to `next build` restores Turbopack as the default without changing
application code or runtime configuration.

This workaround does not establish upstream support for dependency overrides.
In particular, Firestore emulator parity does not make an `@grpc/grpc-js`
version outside Firestore's declared range supported.
