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
import { git, remoteBranchTip } from "./git";
import { originOf, type RepoEntry } from "./projects";
import { executionAvailable, type Choices } from "./service";
import { CAPABILITIES, type Capability } from "./contract";

export const executionRoots = (): string[] => (process.env.CC_EXECUTION_ROOTS ?? homedir()).split(",").map((s) => s.trim()).filter(Boolean);

/** The remote tip of a branch, read through a verified local checkout of the project (null when there is none). */
export function checkoutRemoteTip(roots: string[], timeoutMs?: number) {
  return async (entry: RepoEntry & { origin: string }, branch: string): Promise<string | null> => {
    for (const root of roots) for (const dir of entry.checkouts) {
      const p = join(/*turbopackIgnore: true*/ root, dir);
      if (!existsSync(join(/*turbopackIgnore: true*/ p, ".git"))) continue;
      const remote = await git(p, ["remote", "get-url", "origin"]);
      if (remote.ok && originOf(remote.out)?.toLowerCase() === entry.origin.toLowerCase()) return remoteBranchTip(p, branch, timeoutMs);
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
const disabled = () => noStoreJson({ data: null, error: { code: "production_dispatch_disabled", message: "Execution from Universal Command is not enabled yet. Nothing was run." } }, 403);

/** Shared front half of both routes, after the route's own owner guard: gate, body, the founder's shadow record. */
export async function executionRequestContext(req: Request, guard: Extract<Awaited<ReturnType<typeof guardProtectedMutation>>, { ok: true }>) {
  if (!executionAvailable()) return { ok: false as const, response: disabled() };
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
