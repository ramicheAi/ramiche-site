/**
 * Composed guards. These are the ONLY functions route handlers should call.
 *
 * guardProtectedMutation: exact Origin -> owner identity -> session-bound CSRF.
 * guardPrivateRead:       owner identity only (reads must have no side effects,
 *                         and requiring Origin would break normal navigation).
 *
 * Both are side-effect free on denial: no writes, no dispatch, no outbound
 * calls, no cookies set. Callers MUST invoke the guard before parsing the body
 * or touching any provider.
 */
import type { NextResponse } from "next/server";
import {
  denialResponse,
  requireOwnerIdentity,
  type IdentityDeps,
} from "./owner-identity";
import { verifyExactOrigin } from "./origin-guard";
import { CSRF_HEADER, verifyCsrfToken } from "./csrf";

export type GuardSuccess = { ok: true; uid: string; sessionCookie: string };
export type GuardFailure = {
  ok: false;
  status: number;
  reason: string;
  response: NextResponse;
};
export type GuardResult = GuardSuccess | GuardFailure;

export interface GuardDeps extends IdentityDeps {
  nowMs?: number;
}

function fail(status: number, reason: string): GuardFailure {
  return { ok: false, status, reason, response: denialResponse(status, reason) };
}

export async function guardPrivateRead(
  req: { headers: Headers },
  deps: GuardDeps = {}
): Promise<GuardResult> {
  const id = await requireOwnerIdentity(req, deps);
  if (!id.ok) return fail(id.status, id.reason);
  return { ok: true, uid: id.uid, sessionCookie: id.sessionCookie };
}

export async function guardProtectedMutation(
  req: { headers: Headers },
  deps: GuardDeps = {}
): Promise<GuardResult> {
  const env = deps.env ?? process.env;

  // 1. Exact origin first: cheapest check, and it must hold independently of
  //    any approval or identity evidence elsewhere in the request.
  const origin = verifyExactOrigin(req, env);
  if (!origin.ok) return fail(origin.status, origin.reason);

  // 2. Canonical authenticated Ramon identity.
  const id = await requireOwnerIdentity(req, deps);
  if (!id.ok) return fail(id.status, id.reason);

  // 3. Session-bound CSRF evidence.
  const csrf = verifyCsrfToken(req.headers.get(CSRF_HEADER), id.sessionCookie, {
    env,
    nowMs: deps.nowMs,
  });
  if (!csrf.ok) return fail(csrf.status, csrf.reason);

  return { ok: true, uid: id.uid, sessionCookie: id.sessionCookie };
}
