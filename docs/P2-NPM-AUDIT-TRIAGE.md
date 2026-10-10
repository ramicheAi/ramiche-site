# P2 npm Audit Triage

Date: 2026-10-10

Scope: current advisory service against the P1 tree represented locally by `ea623f494b46cde701bf46809ae33aeb89e916a6`. No force update, package-manager patch, production deployment, or runtime setting change.

## Result

| Audit | Before | Safe patch set | Delta |
|---|---:|---:|---:|
| All dependencies, high package findings | 29 | 18 | -11 |
| Production-only, high package findings | 15 | 5 | -10 |
| All dependencies, total findings | 49 | 36 | -13 |
| Production-only, total findings | 29 | 18 | -11 |

`npm audit` counts vulnerable package nodes and propagates transitive severity into parents. These counts are not 29 distinct proven exploits.

## Applied safe set

Direct dependencies stayed within their existing major lines:

- `firebase` 12.9 range to 12.19 range;
- `firebase-admin` 13.6 range to 13.10 range;
- `shadcn` 4.11 range to 4.21 range.

Existing security overrides moved to fixed patch/minor releases:

- `protobufjs` 7.6.6;
- `vite` 7.3.7;
- `brace-expansion` 2.1.7;
- `ip-address` 10.7.3;
- `postcss` 8.5.29.

Narrow transitive overrides were added where the requesting dependency's major API remains unchanged:

- `@fastify/busboy` 3.2.3;
- `google-gax > @grpc/grpc-js` 1.14.6;
- `browserslist` 4.29.3;
- `fast-uri` 3.1.8;
- `form-data` 2.5.6;
- `ws` `^8.21.0` (the committed lockfile resolves 8.22.0).

The exact lockfile was regenerated without lifecycle scripts or `--force`.

## Remaining production findings

| Audit node | Direct / transitive | Runtime path | Reachability judgment | Disposition |
|---|---|---|---|---|
| `nodemailer` 8.0.7 | direct | Command Center gate approval email and lead-send routes | reachable; recipient fields can be user/CRM-derived, although the app does not expose raw message or transport options | hold for a separate Nodemailer 10 compatibility patch; audit requires a major update |
| `@grpc/grpc-js` 1.9.16 | transitive | `firebase` Firestore web/compat SDK | client connects to configured Google service; vulnerable server/auth APIs are not directly called by repository code | hold; parent pins `~1.9.0`, and overriding to 1.14.6 would cross the declared range |
| `@firebase/firestore` | transitive parent | `firebase` | inherits the gRPC finding | same hold |
| `@firebase/firestore-compat` | transitive parent | `firebase` | inherits the Firestore/gRPC finding | same hold |
| `firebase` | direct parent | browser Firestore/auth code | inherits the Firestore/gRPC finding | same hold |

Production reachability is not zero. The remaining findings are held because the available fix requires either a major direct dependency change or overriding a child beyond its parent's declared range. That is a review gate, not permission to ignore them.

## Remaining development findings

Thirteen high package nodes are development/build tooling: `@modelcontextprotocol/sdk`, `@next/eslint-plugin-next`, `@shadcn/registry`, `@ts-morph/common`, `braces`, `eslint-config-next`, `fast-glob`, `hono`, `js-yaml`, `lint-staged`, `micromatch`, `shadcn`, and `ts-morph`.

They enter through linting, shadcn code generation, YAML/config parsing, and related CLI paths. They are not shipped as application server dependencies under a production-only install, but crafted local project input can reach several parsers. `npm audit` proposes misleading breaking downgrades for parts of this tree, including `eslint-config-next@14.2.35` and `shadcn@1.0.0`; those were rejected.

Two packages in the wider audit currently have no non-vulnerable published release in the inspected line (`braces` 3.0.3 and `node-forge` 1.4.0). They require upstream releases or parent replacement, not a fabricated override.

## Verification

- exact lockfile install: passed;
- unit/integration suite: 483 passed, 4 skipped;
- TypeScript: passed;
- ESLint: zero errors, 189 pre-existing warnings;
- production audit: 15 high to 5 high;
- full audit: 29 high to 18 high;
- production build: inconclusive; two isolated P2 builds remained at `Creating an optimized production build` with no additional output and were terminated after bounded observation. This repeats the earlier intermittent baseline behavior and is not reported as a pass.

## Next gates

1. Test a dedicated Nodemailer 10 patch against both email routes and a sandbox SMTP transport.
2. Wait for or explicitly approve a Firebase/gRPC compatibility experiment that crosses the parent range.
3. Re-run audits because the advisory database is time-sensitive.
4. Require a clean, time-bounded production build before merge.
