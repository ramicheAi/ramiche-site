/**
 * P06 M6C: Universal Command -> routing decision -> execution request -> founder approval -> executor -> result.
 *
 * The server derives everything. A client sends only a shadow command id and the founder's narrowing choices
 * (project, capability, branch); it never sends an ExecutionRequest. `prepare` builds the exact request from the stored
 * decision, the registry and the remote head, and shows the founder the smallest decision. `approve` derives it AGAIN
 * and runs only if its binding hash equals the one the founder saw, so anything that moved in between (a new commit,
 * a changed decision) stops instead of running something the founder did not see. The approval is signed with the
 * session founder's uid. The executor never writes Missions.
 *
 * Routes call this with surface "production": while PRODUCTION_DISPATCH_ENABLED is false nothing executes from the
 * live cockpit, whatever the request. Tests drive the same code with surface "harness" and a fake CLI.
 */
import { randomUUID } from "node:crypto";
import { approve, approvalKey as defaultKey } from "./approval";
import { bindingHash, CAPABILITIES, CAPABILITY_META, capabilityRank, EXECUTABLE_CAPABILITIES, type Capability, type ExecutionRequest, type ExecutionResult } from "./contract";
import { runExecution, type ExecutionDeps } from "./executor";
import { missionSuggestion, type MissionSuggestion } from "./mission";
import { PRODUCTION_DISPATCH_ENABLED, surfaceAllowed } from "./policy";
import { bySlug, projectName, resolveProject, REPO_REGISTRY, type RepoEntry } from "./projects";
import type { ShadowRecord } from "@/lib/command/types";

export interface Choices { project?: string; capability?: Capability; branch?: string }

export type Prepared =
  | { ok: true; request: ExecutionRequest; bindingHash: string; sentence: string; projectName: string; details: Record<string, string> }
  | { ok: false; code: string; message: string; question?: string; candidates?: string[] };

export interface PrepareDeps {
  /** The current tip of a branch on a project's remote (the stale-head source of truth). */
  remoteTip: (entry: RepoEntry & { origin: string }, branch: string) => Promise<string | null>;
  registry?: readonly RepoEntry[];
  now?: () => number;
  limits?: ExecutionRequest["limits"];
}

const DEFAULT_LIMITS: ExecutionRequest["limits"] = { timeoutMs: 30 * 60_000, maxTurns: 60, maxBudgetUsd: null };

/** The capability a decision implies, before any founder narrowing: change work is L2, everything else analyzes. */
export function impliedCapability(decision: ShadowRecord["decision"]): Capability {
  return decision.intent === "implementation" ? "L2" : "L1";
}

/** Which executor a routing decision maps to today. Only Claude Code is implemented; everything else stops plainly. */
function executorFor(decision: ShadowRecord["decision"]): { ok: true } | { ok: false; code: string; message: string } {
  if (decision.handler === "claude_code") return { ok: true };
  if (decision.handler === "human") return { ok: false, code: "founder_authority", message: "This one is yours: it needs founder authority, so Parallax will not run it." };
  if (decision.handler === null) return { ok: false, code: "needs_handler", message: "Pick who should do this first (Details)." };
  return { ok: false, code: "no_executor", message: `There is no executor for ${decision.handler} yet. Only Claude Code runs work today.` };
}

export async function prepareExecution(input: { record: ShadowRecord; founderUid: string; choices?: Choices }, deps: PrepareDeps): Promise<Prepared> {
  const { record, founderUid } = input;
  const choices = input.choices ?? {};
  const ex = executorFor(record.decision);
  if (!ex.ok) return ex;

  // Capability: what the decision implies, narrowed (never widened) by the founder, never above what can execute.
  const implied = impliedCapability(record.decision);
  const asked = choices.capability ?? implied;
  if (!CAPABILITIES.includes(asked)) return { ok: false, code: "capability_invalid", message: "Unknown capability." };
  if (capabilityRank(asked) > capabilityRank(implied)) return { ok: false, code: "capability_widened", message: `This command implies ${implied}; it cannot be approved at ${asked}.` };
  if (!EXECUTABLE_CAPABILITIES.includes(asked)) return { ok: false, code: "capability_unavailable", message: `${asked} needs an OS sandbox that is not enabled yet.` };

  const registry = deps.registry ?? REPO_REGISTRY;
  const resolved = choices.project ? bySlug(choices.project, registry) : resolveProject(record.command, registry);
  if (!resolved.ok) return { ok: false, code: resolved.code, message: resolved.question, question: resolved.question, candidates: resolved.candidates };

  const branch = choices.branch ?? "main";
  const head = await deps.remoteTip(resolved.entry, branch);
  if (!head) return { ok: false, code: "branch_unknown", message: `Could not read ${branch} of ${resolved.entry.origin}.` };

  const request: ExecutionRequest = {
    executionId: randomUUID(), commandId: record.id, missionId: record.missionContext, founder: { uid: founderUid }, executor: "claude_code",
    project: { slug: resolved.entry.slug }, repository: { origin: resolved.entry.origin, branch, head },
    task: { instruction: record.command, contextRefs: [`command:${record.id}`] }, capability: asked, limits: deps.limits ?? DEFAULT_LIMITS,
    // One logical execution per command, capability, project and commit: retrying the same approval never runs twice.
    idempotencyKey: `cmd:${record.id}:${asked}:${resolved.entry.slug}:${branch}:${head}`,
    createdAt: new Date((deps.now ?? Date.now)()).toISOString(),
  };
  const name = resolved.name;
  return {
    ok: true, request, bindingHash: bindingHash(request), projectName: name,
    sentence: `Claude Code wants to ${CAPABILITY_META[asked].verb} ${name}${capabilityRank(asked) >= capabilityRank("L2") ? " locally" : ""}.`,
    details: {
      Executor: "Claude Code", Project: name, Repository: resolved.entry.origin, Branch: branch, Head: head.slice(0, 7),
      Capability: `${asked} (${CAPABILITY_META[asked].label})`, Task: record.command, "Never allowed": "push, pull request, merge, deploy, migration, credentials, external messages, payments, production changes",
    },
  };
}

export type Approved =
  | { ok: true; result: ExecutionResult; mission: MissionSuggestion }
  | { ok: false; code: string; message: string };

export interface ApproveDeps extends PrepareDeps {
  executor: Omit<ExecutionDeps, "approvalKey" | "ownerUid" | "surface">;
  surface: ExecutionDeps["surface"];
  ownerUid: string;
  approvalKey?: Buffer | null;
}

/** The founder approved what `prepare` showed. Derive again, compare, sign with the session founder, run. */
export async function approveExecution(input: { record: ShadowRecord; founderUid: string; choices?: Choices; seenBindingHash: string }, deps: ApproveDeps): Promise<Approved> {
  // The production gate answers first, before any derivation, remote read or store write.
  const gate = surfaceAllowed(deps.surface);
  if (!gate.ok) return gate;
  if (input.founderUid !== deps.ownerUid) return { ok: false, code: "not_founder", message: "Only the founder can approve an execution." };
  if (typeof input.seenBindingHash !== "string" || !/^[0-9a-f]{64}$/.test(input.seenBindingHash)) return { ok: false, code: "approval_invalid", message: "Missing the approval you were shown." };

  const again = await prepareExecution(input, deps);
  if (!again.ok) return again;
  if (again.bindingHash !== input.seenBindingHash) {
    return { ok: false, code: "changed_since_shown", message: "Something changed since you looked (a new commit or a different decision). Review it again; nothing ran." };
  }
  const key = deps.approvalKey === undefined ? defaultKey() : deps.approvalKey;
  if (!key) return { ok: false, code: "approval_key_unavailable", message: "Approvals cannot be signed on this host. Nothing ran." };
  const approval = approve(again.request, input.founderUid, key);
  const result = await runExecution(again.request, approval, { ...deps.executor, surface: deps.surface, ownerUid: deps.ownerUid, approvalKey: key });
  return { ok: true, result, mission: missionSuggestion({ missionId: again.request.missionId, missionRecommended: input.record.decision.missionRecommended, result }) };
}

/** Whether the cockpit should offer execution at all (the UI hides it otherwise). */
export const executionAvailable = (): boolean => PRODUCTION_DISPATCH_ENABLED && surfaceAllowed("production").ok;

export { projectName };
