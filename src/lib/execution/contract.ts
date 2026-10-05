/**
 * P06 M6 controlled execution: the one contract every executor receives and returns.
 *
 * An ExecutionRequest binds exactly what may happen: which founder command, which executor, which project and
 * repository, which commit it starts from, which capability level, and which task. An approval signs that binding
 * (approval.ts); anything that differs is a different request and needs its own approval.
 *
 * Capability levels are ordered and local-only. Consequential acts (push, PR, merge, deploy, migration, credential
 * change, external message, payment, production mutation) are NOT levels: no ExecutionRequest can grant them. They
 * need separately bound authority that M6 does not provide.
 *
 * Neither object carries secrets, credentials or conversation history: the task text, references by id, and facts.
 */
import { createHash } from "node:crypto";

export const CAPABILITIES = ["L0", "L1", "L2", "L3", "L4"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_META: Record<Capability, { label: string; verb: string }> = {
  L0: { label: "Observe", verb: "inspect" },
  L1: { label: "Analyze", verb: "analyze" },
  L2: { label: "Modify locally", verb: "modify" },
  L3: { label: "Modify and run tests", verb: "modify and test" },
  L4: { label: "Commit locally", verb: "commit to" },
};

/** Never grantable through an ExecutionRequest. Listed so a request or a next step can name them and be refused. */
export const CONSEQUENTIAL_ACTIONS = [
  "push", "pull_request", "merge", "deploy", "migration", "credential_change", "external_message", "payment", "production_mutation",
] as const;
export type ConsequentialAction = (typeof CONSEQUENTIAL_ACTIONS)[number];

export const EXECUTORS = ["claude_code"] as const;
export type Executor = (typeof EXECUTORS)[number];

export const capabilityRank = (c: Capability) => CAPABILITIES.indexOf(c);

/**
 * Levels M6 can execute. L3 and L4 run the repository's own code (test scripts, commit hooks), which can do anything
 * the user account can, including network pushes with the user's credentials and edits to the shared .git directory.
 * Git-level guards cannot bound that (reproduced in review: `npm test` ran `env -u GIT_CONFIG_COUNT git push`). They
 * stay unavailable until the executor runs inside an OS sandbox (no network, writes only in the worktree).
 */
export const EXECUTABLE_CAPABILITIES: readonly Capability[] = ["L0", "L1", "L2"];

export interface ExecutionRequest {
  executionId: string;
  /** The Universal Command record this came from (a shadow decision id), or null for a harness request. */
  commandId: string | null;
  missionId: string | null;
  founder: { uid: string };
  executor: Executor;
  project: { slug: string };
  repository: {
    /** Canonical "owner/repo", checked against the checkout's origin remote before anything runs. */
    origin: string;
    /** The branch the work starts from, and the exact commit approved. A moved branch is a different request. */
    branch: string;
    head: string;
  };
  task: { instruction: string; contextRefs: string[] };
  capability: Capability;
  limits: { timeoutMs: number; maxTurns: number; maxBudgetUsd: number | null };
  idempotencyKey: string;
  createdAt: string;
}

export type ExecutionStatus =
  | "succeeded"          // ran inside its boundary
  | "failed"             // ran and the executor reported failure
  | "canceled"
  | "timed_out"
  | "boundary_violation" // ran, but the post-run checks found an act outside the granted capability
  | "rejected";          // never ran: the contract, approval, project, repository or gate check failed

export interface ExecutionCheck { command: string; ok: boolean }

export interface NextStep {
  action: string;
  /** A capability that a new, separately approved request could grant; null when it is consequential. */
  capability: Capability | null;
  consequential: ConsequentialAction | null;
}

export interface ExecutionResult {
  executionId: string;
  executor: Executor;
  status: ExecutionStatus;
  startedAt: string | null;
  completedAt: string;
  project: string;
  repository: string;
  branch: string | null;
  baseHead: string;
  /** The execution branch tip when it differs from the base (L4 commits), else null. */
  resultingHead: string | null;
  worktree: string | null;
  filesChanged: string[];
  checks: ExecutionCheck[];
  summary: string;
  /** Plain facts with no secrets; full stream lives in the log at `logPath`. */
  evidence: { logPath: string | null; turns: number | null; modelReported: string | null };
  usage: { inputTokens: number | null; outputTokens: number | null; billing: "subscription"; reportedCostEstimateUsd: number | null };
  warnings: string[];
  nextStep: NextStep | null;
  /** Smallest actionable explanation when status is rejected, failed, timed_out, canceled or boundary_violation. */
  failure: { code: string; message: string } | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{40}$/;
const ORIGIN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]{1,200}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_TIMEOUT_MS = 60 * 60 * 1000;

/** Structural validation. Returns the problems; an empty list means the request is well formed. */
export function invalidRequest(r: unknown): string[] {
  const p: string[] = [];
  const o = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!o(r)) return ["request must be an object"];
  if (typeof r.executionId !== "string" || !UUID.test(r.executionId)) p.push("executionId must be a UUID");
  if (r.commandId !== null && (typeof r.commandId !== "string" || !UUID.test(r.commandId))) p.push("commandId must be a UUID or null");
  if (r.missionId !== null && (typeof r.missionId !== "string" || !UUID.test(r.missionId))) p.push("missionId must be a UUID or null");
  if (!o(r.founder) || typeof r.founder.uid !== "string" || !r.founder.uid) p.push("founder.uid is required");
  if (!EXECUTORS.includes(r.executor as Executor)) p.push(`executor must be one of ${EXECUTORS.join(", ")}`);
  if (!o(r.project) || typeof r.project.slug !== "string" || !SLUG.test(r.project.slug)) p.push("project.slug is invalid");
  if (!o(r.repository)) p.push("repository is required");
  else {
    if (typeof r.repository.origin !== "string" || !ORIGIN.test(r.repository.origin)) p.push("repository.origin must be owner/repo");
    if (typeof r.repository.branch !== "string" || !BRANCH.test(r.repository.branch)) p.push("repository.branch is invalid");
    if (typeof r.repository.head !== "string" || !SHA.test(r.repository.head)) p.push("repository.head must be a 40-character commit");
  }
  if (!o(r.task) || typeof r.task.instruction !== "string" || !r.task.instruction.trim() || r.task.instruction.length > 20000) p.push("task.instruction is required (at most 20000 characters)");
  else if (!Array.isArray(r.task.contextRefs) || !r.task.contextRefs.every((x) => typeof x === "string" && x.length <= 300)) p.push("task.contextRefs must be a list of references");
  if (!CAPABILITIES.includes(r.capability as Capability)) p.push(`capability must be one of ${CAPABILITIES.join(", ")}`);
  if (!o(r.limits)) p.push("limits are required");
  else {
    const t = r.limits.timeoutMs;
    if (typeof t !== "number" || !Number.isInteger(t) || t < 1000 || t > MAX_TIMEOUT_MS) p.push("limits.timeoutMs must be 1000..3600000");
    const m = r.limits.maxTurns;
    if (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > 200) p.push("limits.maxTurns must be 1..200");
    const b = r.limits.maxBudgetUsd;
    if (b !== null && (typeof b !== "number" || !(b > 0) || b > 100)) p.push("limits.maxBudgetUsd must be null or 0..100");
  }
  if (typeof r.idempotencyKey !== "string" || r.idempotencyKey.length < 8 || r.idempotencyKey.length > 200) p.push("idempotencyKey must be 8..200 characters");
  if (typeof r.createdAt !== "string" || Number.isNaN(Date.parse(r.createdAt))) p.push("createdAt must be an ISO time");
  return p;
}

/**
 * Everything an approval covers, in a canonical order. The executionId and createdAt are deliberately excluded: the
 * idempotency key identifies the logical request, so a retry of the same approved work stays the same approval.
 */
export function bindingOf(r: ExecutionRequest) {
  return {
    v: 1,
    commandId: r.commandId,
    missionId: r.missionId,
    founder: r.founder.uid,
    executor: r.executor,
    project: r.project.slug,
    origin: r.repository.origin.toLowerCase(),
    branch: r.repository.branch,
    head: r.repository.head,
    capability: r.capability,
    task: createHash("sha256").update(r.task.instruction, "utf8").digest("hex"),
    contextRefs: [...r.task.contextRefs],
    limits: { timeoutMs: r.limits.timeoutMs, maxTurns: r.limits.maxTurns, maxBudgetUsd: r.limits.maxBudgetUsd },
    idempotencyKey: r.idempotencyKey,
  };
}

export function bindingHash(r: ExecutionRequest): string {
  return createHash("sha256").update(JSON.stringify(bindingOf(r)), "utf8").digest("hex");
}

/** The next approval a finished execution may ask for: one capability step, never a consequential act. */
export function nextStepAfter(capability: Capability, filesChanged: number, committed: boolean): NextStep | null {
  if (capability === "L4" && committed) return { action: "Open a pull request", capability: null, consequential: "pull_request" };
  if (filesChanged === 0) return null;
  const step = (action: string, c: Capability): NextStep | null => (EXECUTABLE_CAPABILITIES.includes(c) ? { action, capability: c, consequential: null } : null);
  if (capability === "L2") return step("Run the tests", "L3");
  if (capability === "L3") return step("Create commit", "L4");
  return null;
}
