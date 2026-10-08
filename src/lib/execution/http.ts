/**
 * P06 M6C route glue. Owner guard -> founder command context -> the shadow record -> the execution service, with
 * surface "production". While PRODUCTION_DISPATCH_ENABLED is false both routes answer production_dispatch_disabled
 * before reading anything: the live cockpit cannot prepare or run an execution, whatever the request says.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { jsonObject, respond } from "@/lib/missions/http";
import { commandContext } from "@/lib/command/http";
import { getShadow } from "@/lib/command/service";
import { guardProtectedMutation } from "@/lib/server/protected-mutation";
import { noStoreJson } from "@/lib/server/cockpit-chat-data";
import { git } from "./git";
import { githubBranchTip } from "./github-app";
import { originOf, type RepoEntry } from "./projects";
import { dispatchHalted } from "./halt";
import { executionAvailable, type Choices } from "./service";
import { CAPABILITIES, type Capability } from "./contract";

export const executionRoots = (): string[] => (process.env.CC_EXECUTION_ROOTS ?? homedir()).split(",").map((s) => s.trim()).filter(Boolean);

/**
 * The remote tip of a branch for a project that has a verified local checkout on this host (null when there is none),
 * read from GitHub with the executor's own read-only machine identity (github-app.ts). Throws GithubAuthUnavailable
 * when that identity cannot be used; there is no fallback to any person's credential.
 */
export function checkoutRemoteTip(roots: string[], timeoutMs?: number) {
  return async (entry: RepoEntry & { origin: string }, branch: string): Promise<string | null> => {
    for (const root of roots) for (const dir of entry.checkouts) {
      const p = join(/*turbopackIgnore: true*/ root, dir);
      if (!existsSync(join(/*turbopackIgnore: true*/ p, ".git"))) continue;
      const remote = await git(p, ["remote", "get-url", "origin"]);
      if (remote.ok && originOf(remote.out)?.toLowerCase() === entry.origin.toLowerCase()) return githubBranchTip(entry.origin, branch, { timeoutMs });
    }
    return null;
  };
}

export function choicesFrom(body: Record<string, unknown>): Choices | NextResponse {
  const c: Choices = {};
  if (body.project !== undefined) { if (typeof body.project !== "string" || !/^[a-z0-9-]{1,64}$/.test(body.project)) return bad("project is invalid"); c.project = body.project; }
  if (body.capability !== undefined) { if (!CAPABILITIES.includes(body.capability as Capability)) return bad("capability is invalid"); c.capability = body.capability as Capability; }
  if (body.branch !== undefined) { if (typeof body.branch !== "string" || !/^[A-Za-z0-9._/-]{1,200}$/.test(body.branch) || body.branch.includes("..")) return bad("branch is invalid"); c.branch = body.branch; }
  return c;
}
const bad = (message: string) => noStoreJson({ data: null, error: { code: "invalid", message } }, 400);
const halted = () => noStoreJson({ data: null, error: { code: "execution_halted", message: "Execution is halted on the execution host. Nothing was run." } }, 403);
const disabled = () => noStoreJson({ data: null, error: { code: "production_dispatch_disabled", message: "Execution from Universal Command is not enabled yet. Nothing was run." } }, 403);

/** Shared front half of both routes, after the route's own owner guard: gate, body, the founder's shadow record. */
/**
 * The dispatch gate's own answer right now (the 403 response), or null when execution may proceed. Exported so a
 * caller about to make its own database read (the active-run check in the approve route) can fail fast on its own,
 * independent of executionRequestContext's earlier check: the same defense-in-depth this module already applies
 * inside the executor and the service layer, not a single check relied on from one place.
 */
export function executionGate(): ReturnType<typeof halted> | null {
  return executionAvailable() ? null : (dispatchHalted() ? halted() : disabled());
}

export async function executionRequestContext(req: Request, guard: Extract<Awaited<ReturnType<typeof guardProtectedMutation>>, { ok: true }>) {
  const gate = executionGate();
  if (gate) return { ok: false as const, response: gate };
  const c = commandContext(guard);
  if (!c.ok) return { ok: false as const, response: c.response };
  const body = await jsonObject(req);
  if (body instanceof Response) return { ok: false as const, response: body as NextResponse };
  const shadow = await getShadow(c.ctx, body.commandId);
  if (!shadow.ok) return { ok: false as const, response: respond(shadow) };
  const choices = choicesFrom(body);
  if (choices instanceof NextResponse) return { ok: false as const, response: choices };
  return { ok: true as const, uid: guard.uid, record: shadow.data, choices, body };
}
