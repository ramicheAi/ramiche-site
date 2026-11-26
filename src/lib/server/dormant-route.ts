import { NextResponse } from "next/server";

/**
 * CC-CLOSURE-02: shared guard for routes under src/app/api/{stripe,notifications,push}/ that
 * .vercelignore used to keep out of every deployment entirely. That exclusion collided with
 * Next's output-file tracing on a `vercel build` + `vercel deploy --prebuilt` release (a
 * remote "readlink ENOENT" on the excluded source path, failing the whole deploy) and gave these
 * routes no auditable, code-level record of being unreachable — their safety was an accidental
 * side effect of a deploy-config line, not a decision.
 *
 * This makes that decision explicit instead: every handler below returns this response FIRST,
 * before any Stripe/notification/push call, any auth check, or any other logic, for every HTTP
 * method the route exports. Nothing downstream ever runs. Re-enabling a route later means
 * removing its one `if (DORMANT) return dormantRouteResponse();` line — the real logic underneath
 * is untouched and already has its own test coverage.
 */
export function dormantRouteResponse(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
