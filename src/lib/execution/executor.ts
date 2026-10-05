/**
 * P06 M6 controlled execution: one founder-approved ExecutionRequest in, one ExecutionResult out.
 *
 * Fail closed, in order, before anything runs: surface gate (production dispatch is off), contract, founder,
 * approval, idempotency, project, repository and checkout, stale head. Then the executor runs in a fresh worktree on
 * its own branch, and afterwards the boundary is verified from git state alone (verifyBoundary), whatever the model
 * said it did. Telemetry goes to execution_events through the existing recorder (subscription cost semantics kept).
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { recordExecution, type ExecutionFacts } from "@/lib/execution-events";
import { verifyApproval, type Approval } from "./approval";
import { runClaudeCode, type ClaudeRunOutcome } from "./claude-code";
import { bindingHash, capabilityRank, invalidRequest, nextStepAfter, type ExecutionRequest, type ExecutionResult, type ExecutionStatus } from "./contract";
import { branchTip, changedFiles, checkoutSnapshot, git, isAncestor, refsSnapshot, revParse } from "./git";
import { surfaceAllowed, type Surface } from "./policy";
import { bySlug, originOf, REPO_REGISTRY, type RepoEntry } from "./projects";
import { executionJobId, type ExecutionStore } from "./store";

export interface ExecutionDeps {
  surface: Surface;
  ownerUid: string;
  approvalKey: Buffer | null;
  /** Directories that may contain project checkouts (the CC_BUILDER_ROOTS idea: nothing outside them is used). */
  roots: string[];
  /** Where execution worktrees and logs are created (never /tmp: macOS clears it). */
  execRoot: string;
  store: ExecutionStore;
  claudeBin: string;
  model?: string | null;
  registry?: readonly RepoEntry[];
  signal?: AbortSignal;
  now?: () => number;
  telemetry?: (f: ExecutionFacts) => Promise<void>;
  /** Tests only (fake CLI). */
  extraEnv?: Record<string, string>;
}

export const execBranch = (executionId: string) => `parallax-exec/${executionId}`;

function base(r: Partial<ExecutionRequest>, now: number): ExecutionResult {
  return {
    executionId: String(r.executionId ?? ""), executor: "claude_code", status: "rejected", startedAt: null, completedAt: new Date(now).toISOString(),
    project: String(r.project?.slug ?? ""), repository: String(r.repository?.origin ?? ""), branch: null, baseHead: String(r.repository?.head ?? ""),
    resultingHead: null, worktree: null, filesChanged: [], checks: [], summary: "", evidence: { logPath: null, turns: null, modelReported: null },
    usage: { inputTokens: null, outputTokens: null, billing: "subscription", reportedCostEstimateUsd: null }, warnings: [], nextStep: null, failure: null,
  };
}

const reject = (r: Partial<ExecutionRequest>, now: number, code: string, message: string): ExecutionResult =>
  ({ ...base(r, now), status: "rejected", summary: message, failure: { code, message } });

export interface BoundaryInput {
  capability: ExecutionRequest["capability"];
  repo: string;
  worktree: string;
  branch: string;
  baseHead: string;
  refsBefore: Map<string, string>;
  checkoutBefore: Awaited<ReturnType<typeof checkoutSnapshot>>;
}

/** What the run did outside its capability, judged from git state only. Empty means inside the boundary. */
export async function verifyBoundary(b: BoundaryInput): Promise<{ violations: string[]; tip: string | null }> {
  const v: string[] = [];
  const [refsAfter, checkoutAfter, tip, wtBranch] = await Promise.all([
    refsSnapshot(b.repo), checkoutSnapshot(b.repo), revParse(b.repo, `refs/heads/${b.branch}`),
    git(b.worktree, ["symbolic-ref", "-q", "HEAD"]).then((r) => (r.ok ? r.out.trim() : null)),
  ]);
  const own = `refs/heads/${b.branch}`;
  for (const ref of new Set([...b.refsBefore.keys(), ...refsAfter.keys()])) {
    if (ref === own) continue;
    if (b.refsBefore.get(ref) !== refsAfter.get(ref)) v.push(`ref changed outside the execution branch: ${ref}`);
  }
  if (checkoutAfter.head !== b.checkoutBefore.head || checkoutAfter.branch !== b.checkoutBefore.branch || checkoutAfter.status !== b.checkoutBefore.status) {
    v.push("the founder's own checkout changed");
  }
  if (wtBranch !== own) v.push("the worktree left the execution branch");
  if (!tip) v.push("the execution branch is missing");
  else if (capabilityRank(b.capability) < capabilityRank("L4")) {
    if (tip !== b.baseHead) v.push("a commit was made without commit capability (L4)");
  } else if (tip !== b.baseHead && !(await isAncestor(b.repo, b.baseHead, tip))) {
    v.push("the execution branch was rewritten (base is no longer an ancestor)");
  }
  if (capabilityRank(b.capability) <= capabilityRank("L1")) {
    const st = await git(b.worktree, ["status", "--porcelain=v1", "--untracked-files=all"]);
    if (st.out.trim()) v.push("files were changed without modify capability (L2)");
  }
  return { violations: v, tip };
}

async function findCheckout(entry: RepoEntry & { origin: string }, roots: string[], head: string): Promise<string | null> {
  for (const root of roots) {
    for (const dir of entry.checkouts) {
      const p = join(root, dir);
      if (!existsSync(join(p, ".git"))) continue;
      const remote = await git(p, ["remote", "get-url", "origin"]);
      if (!remote.ok || originOf(remote.out)?.toLowerCase() !== entry.origin.toLowerCase()) continue;
      if (await revParse(p, head)) return p;
    }
  }
  return null;
}

export async function runExecution(req: ExecutionRequest, approval: Approval | null | undefined, deps: ExecutionDeps): Promise<ExecutionResult> {
  const now = deps.now ?? Date.now;
  const gate = surfaceAllowed(deps.surface);
  if (!gate.ok) return reject(req, now(), gate.code, gate.message);
  const problems = invalidRequest(req);
  if (problems.length) return reject(req, now(), "contract_invalid", `The execution request is invalid: ${problems.join("; ")}.`);
  if (req.founder.uid !== deps.ownerUid) return reject(req, now(), "not_founder", "Only the founder can request an execution.");
  const ap = verifyApproval(req, approval, deps.approvalKey, now());
  if (!ap.ok) return reject(req, now(), ap.code, ap.message);

  const hash = bindingHash(req);
  let begun;
  try { begun = await deps.store.begin(req, hash); }
  catch (e) { return reject(req, now(), "store_unavailable", `The execution could not be recorded, so it did not run (${e instanceof Error ? e.message : "store error"}).`); }
  if (begun.state === "existing") {
    if (begun.bindingHash !== hash) return reject(req, now(), "idempotency_conflict", "This idempotency key was already used for a different request.");
    return begun.result ?? reject(req, now(), "in_progress", "This execution is already running.");
  }

  const finishWith = async (res: ExecutionResult) => { try { await deps.store.finish(req, res); } catch { res.warnings.push("the result could not be saved"); } return res; };

  const resolved = bySlug(req.project.slug, deps.registry ?? REPO_REGISTRY);
  if (!resolved.ok) return finishWith(reject(req, now(), resolved.code, resolved.question));
  if (resolved.entry.origin.toLowerCase() !== req.repository.origin.toLowerCase()) {
    return finishWith(reject(req, now(), "wrong_project", `${resolved.name} is ${resolved.entry.origin}, not ${req.repository.origin}.`));
  }
  const repo = await findCheckout(resolved.entry, deps.roots, req.repository.head);
  if (!repo) return finishWith(reject(req, now(), "repository_unresolved", `No checkout of ${resolved.entry.origin} containing the approved commit was found on this host.`));
  const tip = await branchTip(repo, req.repository.branch);
  if (!tip) return finishWith(reject(req, now(), "branch_unknown", `Branch ${req.repository.branch} was not found in ${resolved.entry.origin}.`));
  if (tip.sha !== req.repository.head) {
    return finishWith(reject(req, now(), "stale_head", `${req.repository.branch} moved since you approved (${req.repository.head.slice(0, 7)} is now ${tip.sha.slice(0, 7)}). Approve again on the current commit.`));
  }

  const dir = join(deps.execRoot, req.project.slug);
  mkdirSync(dir, { recursive: true });
  const worktree = join(dir, req.executionId);
  const logPath = join(dir, `${req.executionId}.log.jsonl`);
  const branch = execBranch(req.executionId);
  const [refsBefore, checkoutBefore] = await Promise.all([refsSnapshot(repo), checkoutSnapshot(repo)]);
  const add = await git(repo, ["worktree", "add", "-b", branch, worktree, req.repository.head]);
  if (!add.ok) return finishWith(reject(req, now(), "worktree_failed", "The isolated worktree could not be created, so nothing ran."));
  // The worktree add itself created the execution branch; that is the one ref change the run may own.
  refsBefore.delete(`refs/heads/${branch}`);

  const startedAtMs = now();
  let run: ClaudeRunOutcome;
  try {
    run = await runClaudeCode({
      bin: deps.claudeBin, cwd: worktree, capability: req.capability, instruction: req.task.instruction, projectName: resolved.name,
      maxTurns: req.limits.maxTurns, maxBudgetUsd: req.limits.maxBudgetUsd, model: deps.model ?? null, timeoutMs: req.limits.timeoutMs,
      signal: deps.signal, logPath, extraEnv: deps.extraEnv,
    });
  } catch {
    run = { exitCode: null, timedOut: false, canceled: false, reportedError: true, resultText: "", modelReported: null, turns: null, inputTokens: null, outputTokens: null, costEstimateUsd: null, checks: [], sawResult: false };
  }
  const completedMs = now();

  const boundary = await verifyBoundary({ capability: req.capability, repo, worktree, branch, baseHead: req.repository.head, refsBefore, checkoutBefore });
  const files = await changedFiles(worktree, req.repository.head);
  const committed = !!boundary.tip && boundary.tip !== req.repository.head;
  const status: ExecutionStatus = boundary.violations.length ? "boundary_violation"
    : run.canceled ? "canceled" : run.timedOut ? "timed_out"
      : !run.sawResult || run.reportedError || run.exitCode !== 0 ? "failed" : "succeeded";
  const failure = status === "succeeded" ? null
    : status === "boundary_violation" ? { code: "boundary_violation", message: `Stopped: the run acted outside ${req.capability}. ${boundary.violations.join("; ")}. Its worktree is kept for review; nothing was pushed.` }
      : status === "canceled" ? { code: "canceled", message: "Canceled. Anything it changed is in its worktree." }
        : status === "timed_out" ? { code: "timed_out", message: `Stopped after ${Math.round(req.limits.timeoutMs / 1000)} seconds. Anything it changed is in its worktree.` }
          : { code: "executor_failed", message: run.sawResult ? (run.resultText.slice(0, 300) || "Claude Code reported a failure.") : "Claude Code did not complete (no result). See the log." };

  const result: ExecutionResult = {
    ...base(req, completedMs), status, startedAt: new Date(startedAtMs).toISOString(), branch, worktree,
    resultingHead: committed ? boundary.tip : null, filesChanged: files, checks: run.checks,
    summary: status === "succeeded" ? (run.resultText.trim().slice(0, 1200) || "Done.") : failure!.message,
    evidence: { logPath, turns: run.turns, modelReported: run.modelReported },
    usage: { inputTokens: run.inputTokens, outputTokens: run.outputTokens, billing: "subscription", reportedCostEstimateUsd: run.costEstimateUsd },
    warnings: run.costEstimateUsd !== null ? ["The CLI's cost figure is a list-price estimate, not marginal spend (subscription)."] : [],
    nextStep: status === "succeeded" ? nextStepAfter(req.capability, files.length, committed) : null,
    failure,
  };

  const facts: ExecutionFacts = {
    executionId: req.executionId, startedAtMs, latencyMs: completedMs - startedAtMs, provider: "claude-max",
    context: { purpose: "job", agentId: "claude-code", correlation: { type: "job", id: executionJobId(req.idempotencyKey) } },
    modelReported: run.modelReported, hasText: !!run.resultText,
    failure: status === "succeeded" ? undefined : { kind: status === "timed_out" ? "timeout" : "exception" },
    usage: { promptTokens: run.inputTokens ?? undefined, completionTokens: run.outputTokens ?? undefined },
  };
  try { await (deps.telemetry ?? recordExecution)(facts); } catch { /* telemetry never changes a result */ }
  return finishWith(result);
}
