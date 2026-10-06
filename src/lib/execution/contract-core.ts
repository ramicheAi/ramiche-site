/**
 * P06 M6: the client-safe half of the execution contract (constants and types only, no Node imports), so cockpit
 * client components can show capabilities and results without bundling node:crypto. contract.ts re-exports all of it
 * and adds the server-side validation and binding hash.
 */
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
