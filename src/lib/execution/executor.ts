/**
 * P06 M6 controlled execution: one founder-approved ExecutionRequest in, one ExecutionResult out.
 *
 * Fail closed, in order, before anything runs: surface gate (production dispatch is off), contract, founder,
 * approval, idempotency, project, repository and checkout, stale head. Then the executor runs in a fresh worktree on
 * its own branch, and afterwards the boundary is verified from git state alone (verifyBoundary), whatever the model
 * said it did. Telemetry goes to execution_events through the existing recorder (subscription cost semantics kept).
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, statfsSync } from "node:fs";
import { join } from "node:path";
import { recordExecution, type ExecutionFacts } from "@/lib/execution-events";
import { verifyApproval, type Approval } from "./approval";
import { runClaudeCode, type ClaudeRunOutcome } from "./claude-code";
import { bindingHash, capabilityRank, EXECUTABLE_CAPABILITIES, invalidRequest, nextStepAfter, type ExecutionRequest, type ExecutionResult, type ExecutionStatus } from "./contract";
import { changedFiles, checkoutSnapshot, commonGitDir, git, gitDirSnapshot, isAncestor, refsSnapshot, remoteBranchTip, revParse, unsafeGitConfig } from "./git";
import { dispatchHalted } from "./halt";
import { surfaceAllowed, withinCeiling, type Surface } from "./policy";
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
  /** Free bytes on the execution volume (default: statfs). Injectable for tests. */
  freeBytes?: (path: string) => number;
  /** Heartbeat and cancel-check interval while running (default 30 s). */
  heartbeatMs?: number;
  /** Required free space before a checkout (default MIN_FREE_BYTES); a small sandbox repository may set less. */
  minFreeBytes?: number;
  /** The branch tip on the remote (default: git ls-remote origin). Injectable for tests. */
  remoteTip?: (repo: string, branch: string) => Promise<string | null>;
}

export const execBranch = (executionId: string) => `parallax-exec/${executionId}`;

/** Finished outcomes that may run again under the same approval (a boundary violation never does). */
const RETRYABLE: ReadonlySet<string> = new Set(["failed", "canceled", "timed_out", "rejected"]);

/** A full checkout needs room; the execution host is also the fleet gateway, so never fill its disk (fail closed). */
export const MIN_FREE_BYTES = 4 * 1024 ** 3;
/** No caller can lower the floor below this. */
export const ABSOLUTE_MIN_FREE_BYTES = 256 * 1024 ** 2;
const statfsFree = (p: string) => { const s = statfsSync(p); return Number(s.bavail) * Number(s.bsize); };

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
  gitDirBefore: string;
  worktreeName: string;
  /** The shared git directory, resolved before the run. */
  commonDir: string;
}

/** What the run did outside its capability, judged from git state only. Empty means inside the boundary. */
export async function verifyBoundary(b: BoundaryInput): Promise<{ violations: string[]; tip: string | null; gitTrusted: boolean }> {
  const v: string[] = [];
  // FIRST, with filesystem reads only: is the git configuration the run could have poisoned still what it was, and does
  // the worktree still point at its own metadata? If not, no git command runs here at all (a planted filter driver,
  // fsmonitor or redirected gitdir would otherwise execute inside these very checks).
  const gitDirAfter = gitDirSnapshot(b.commonDir, b.worktreeName);
  let link = "";
  try { link = readFileSync(join(/*turbopackIgnore: true*/ b.worktree, ".git"), "utf8").trim(); } catch { /* missing: tampered */ }
  const linkOk = link === `gitdir: ${join(/*turbopackIgnore: true*/ b.commonDir, "worktrees", b.worktreeName)}`;
  if (gitDirAfter !== b.gitDirBefore) v.push("the shared .git directory changed (config, hooks, info or another worktree); it must be inspected and cleaned before anyone uses git there");
  if (!linkOk) v.push("the worktree's .git link was changed");
  if (v.length) return { violations: v, tip: null, gitTrusted: false };
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
    // A fresh worktree holds only tracked files, so ANY other file, gitignored ones included (.env.local, *.log), was
    // written by the run. Fail closed when status cannot be read.
    const st = await git(b.worktree, ["status", "--porcelain=v1", "--untracked-files=all", "--ignored=matching"]);
    if (!st.ok || st.out.trim()) v.push("files were changed without modify capability (L2)");
  }
  return { violations: v, tip, gitTrusted: true };
}

async function findCheckout(entry: RepoEntry & { origin: string }, roots: string[], head: string): Promise<string | null> {
  for (const root of roots) {
    for (const dir of entry.checkouts) {
      const p = join(/*turbopackIgnore: true*/ root, dir);
      if (!existsSync(join(/*turbopackIgnore: true*/ p, ".git"))) continue;
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
  if (deps.surface === "production" && dispatchHalted()) return reject(req, now(), "execution_halted", "Execution is halted on the execution host. Nothing was run.");
  const problems = invalidRequest(req);
  if (problems.length) return reject(req, now(), "contract_invalid", `The execution request is invalid: ${problems.join(/*turbopackIgnore: true*/ "; ")}.`);
  if (req.founder.uid !== deps.ownerUid) return reject(req, now(), "not_founder", "Only the founder can request an execution.");
  const ap = verifyApproval(req, approval, deps.approvalKey, now());
  if (!ap.ok) return reject(req, now(), ap.code, ap.message);
  if (!EXECUTABLE_CAPABILITIES.includes(req.capability)) {
    return reject(req, now(), "capability_unavailable", `${req.capability} runs the repository's own code and needs an OS sandbox that is not built yet. Nothing was run; approve up to L2 (modify locally).`);
  }
  // Defense in depth behind prepare: the surface's capability ceiling (production phase 1: L0/L1), before anything is
  // read, recorded or run.
  if (!withinCeiling(deps.surface, req.capability)) return reject(req, now(), "capability_not_enabled", `${req.capability} is not enabled on this surface. Nothing was run.`);

  // Every check that can fail for a transient reason runs BEFORE the record exists, so a refusal never uses up the
  // idempotency key (PR #52 red team): only a real start is recorded.
  const resolved = bySlug(req.project.slug, deps.registry ?? REPO_REGISTRY);
  if (!resolved.ok) return reject(req, now(), resolved.code, resolved.question);
  if (resolved.entry.origin.toLowerCase() !== req.repository.origin.toLowerCase()) {
    return reject(req, now(), "wrong_project", `${resolved.name} is ${resolved.entry.origin}, not ${req.repository.origin}.`);
  }
  const repo = await findCheckout(resolved.entry, deps.roots, req.repository.head);
  if (!repo) return reject(req, now(), "repository_unresolved", `NO VERIFIED LOCAL CHECKOUT: no checkout of ${resolved.entry.origin} with that origin and the approved commit exists on this host. Nothing was run.`);
  // Checked against the remote itself, not a possibly stale remote-tracking ref; unreachable fails closed.
  const tipSha = await (deps.remoteTip ?? remoteBranchTip)(repo, req.repository.branch);
  if (!tipSha) return reject(req, now(), "branch_unknown", `Could not confirm the current ${req.repository.branch} of ${resolved.entry.origin} (branch missing or remote unreachable).`);
  if (tipSha !== req.repository.head) {
    return reject(req, now(), "stale_head", `${req.repository.branch} moved since you approved (${req.repository.head.slice(0, 7)} is now ${tipSha.slice(0, 7)}). Approve again on the current commit.`);
  }
  const commonDir = await commonGitDir(repo);
  if (!commonDir) return reject(req, now(), "repository_unresolved", "The checkout's git directory could not be read. Nothing was run.");
  // Before any git command that could run a configured program (status runs clean filters, checkout runs smudge):
  // a checkout whose configuration names one is refused until a person cleans it (PR #52 red team R3).
  const unsafe = unsafeGitConfig(commonDir);
  if (unsafe.length) {
    return reject(req, now(), "repository_unsafe", `The checkout's git configuration (${commonDir}) makes git run programs (${unsafe.slice(0, 5).join(", ")}). Nothing was run. Inspect and clean it before using git there.`);
  }

  mkdirSync(join(/*turbopackIgnore: true*/ deps.execRoot, req.project.slug), { recursive: true });
  let free = NaN;
  try { free = (deps.freeBytes ?? statfsFree)(deps.execRoot); } catch { /* unknown free space: refused below */ }
  const need = Math.max(deps.minFreeBytes ?? MIN_FREE_BYTES, ABSOLUTE_MIN_FREE_BYTES);
  if (!(free >= need)) {
    return reject(req, now(), "disk_low", `Only ${(free / 1024 ** 3).toFixed(1)} GB free on the execution host (need ${(need / 1024 ** 3).toFixed(1)} GB). Nothing was run.`);
  }

  const hash = bindingHash(req);
  let begun;
  try { begun = await deps.store.begin(req, hash); }
  catch (e) { return reject(req, now(), "store_unavailable", `The execution could not be recorded, so it did not run (${e instanceof Error ? e.message : "store error"}).`); }
  if (begun.state === "existing") {
    if (begun.bindingHash !== hash) return reject(req, now(), "idempotency_conflict", "This idempotency key was already used for a different request.");
    if (!begun.result) return reject(req, now(), "in_progress", "This execution is already running.");
    // A finished attempt that did not succeed may run again under the same approval, unless it violated its boundary.
    // An abandoned attempt (its process died before recording a result) might have been a violation: never re-run it.
    const retryable = RETRYABLE.has(begun.result.status) && begun.result.failure?.code !== "abandoned" && !!deps.store.restart;
    if (!retryable) return begun.result;
    let restarted = false;
    try { restarted = await deps.store.restart!(req, begun.result, hash); } catch { /* treated as not restarted */ }
    if (!restarted) return reject(req, now(), "in_progress", "This execution is already being retried.");
  }

  const finishWith = async (res: ExecutionResult) => { try { await deps.store.finish(req, res); } catch { res.warnings.push("the result could not be saved"); } return res; };
  // Canonical path: permission allow rules must match the resolved path too (macOS /var is /private/var).
  const dir = realpathSync(join(/*turbopackIgnore: true*/ deps.execRoot, req.project.slug));
  const worktree = join(/*turbopackIgnore: true*/ dir, req.executionId);
  const logPath = join(/*turbopackIgnore: true*/ dir, `${req.executionId}.log.jsonl`);
  const branch = execBranch(req.executionId);
  const [refsBefore, checkoutBefore] = await Promise.all([refsSnapshot(repo), checkoutSnapshot(repo)]);
  // A full checkout of a large repository can take minutes on a busy host: bounded, but not by the 60s read default.
  const add = await git(repo, ["worktree", "add", "--quiet", "-b", branch, worktree, req.repository.head], undefined, 5 * 60_000);
  if (!add.ok) {
    const why = add.err.replace(/\s+/g, " ").trim().slice(-300);
    return finishWith(reject(req, now(), "worktree_failed", `The isolated worktree could not be created, so nothing ran (git: ${why || "no output"}).`));
  }
  // The worktree add itself created the execution branch; that is the one ref change the run may own.
  refsBefore.delete(`refs/heads/${branch}`);
  // Baseline of the shared git directory AFTER the worktree exists (its own metadata files are part of the snapshot).
  const gitDirBefore = gitDirSnapshot(commonDir, req.executionId);

  const startedAtMs = now();
  // One abort for the run: the caller's signal, or a founder cancel seen at a heartbeat.
  const ac = new AbortController();
  const onCallerAbort = () => ac.abort();
  if (deps.signal?.aborted) ac.abort(); else deps.signal?.addEventListener("abort", onCallerAbort, { once: true });
  let heartbeatFailures = 0;
  const beat = setInterval(async () => {
    try {
      await deps.store.heartbeat?.(req);
      if (await deps.store.cancelRequested?.(req)) ac.abort();
    } catch { heartbeatFailures++; }
  }, deps.heartbeatMs ?? 30_000);
  let run: ClaudeRunOutcome;
  try {
    run = await runClaudeCode({
      bin: deps.claudeBin, cwd: worktree, capability: req.capability, instruction: req.task.instruction, projectName: resolved.name,
      maxTurns: req.limits.maxTurns, maxBudgetUsd: req.limits.maxBudgetUsd, model: deps.model ?? null, timeoutMs: req.limits.timeoutMs,
      signal: ac.signal, logPath, extraEnv: deps.extraEnv,
      onSpawn: (pid) => { deps.store.recordProcess?.(req, pid).catch(() => { heartbeatFailures++; }); },
    });
  } catch {
    run = { exitCode: null, timedOut: false, canceled: false, reportedError: true, resultText: "", modelReported: null, turns: null, inputTokens: null, outputTokens: null, costEstimateUsd: null, checks: [], sawResult: false };
  } finally {
    clearInterval(beat);
    deps.signal?.removeEventListener("abort", onCallerAbort);
  }
  const completedMs = now();

  const boundary = await verifyBoundary({ capability: req.capability, repo, worktree, branch, baseHead: req.repository.head, refsBefore, checkoutBefore, gitDirBefore, worktreeName: req.executionId, commonDir });
  // No git runs against a tampered repository: the file list is then unknown (and the result is a violation anyway).
  const files = boundary.gitTrusted ? await changedFiles(worktree, req.repository.head) : [];
  const committed = !!boundary.tip && boundary.tip !== req.repository.head;
  const status: ExecutionStatus = boundary.violations.length ? "boundary_violation"
    : run.canceled ? "canceled" : run.timedOut ? "timed_out"
      : !run.sawResult || run.reportedError || run.exitCode !== 0 ? "failed" : "succeeded";
  const failure = status === "succeeded" ? null
    : status === "boundary_violation" ? { code: "boundary_violation", message: `Stopped: the run acted outside ${req.capability}. ${boundary.violations.join(/*turbopackIgnore: true*/ "; ")}. Its worktree is kept for review; nothing was pushed.` }
      : status === "canceled" ? { code: "canceled", message: "Canceled. Anything it changed is in its worktree." }
        : status === "timed_out" ? { code: "timed_out", message: `Stopped after ${Math.round(req.limits.timeoutMs / 1000)} seconds. Anything it changed is in its worktree.` }
          : { code: "executor_failed", message: run.sawResult ? (run.resultText.slice(0, 300) || "Claude Code reported a failure.") : "Claude Code did not complete (no result). See the log." };

  const result: ExecutionResult = {
    ...base(req, completedMs), status, startedAt: new Date(startedAtMs).toISOString(), branch, worktree,
    resultingHead: committed ? boundary.tip : null, filesChanged: files, checks: run.checks,
    summary: status === "succeeded" ? (run.resultText.trim().slice(0, 1200) || "Done.") : failure!.message,
    evidence: { logPath, turns: run.turns, modelReported: run.modelReported },
    usage: { inputTokens: run.inputTokens, outputTokens: run.outputTokens, billing: "subscription", reportedCostEstimateUsd: run.costEstimateUsd },
    warnings: [
      ...(run.costEstimateUsd !== null ? ["The CLI's cost figure is a list-price estimate, not marginal spend (subscription)."] : []),
      ...(heartbeatFailures ? [`${heartbeatFailures} heartbeat(s) could not be recorded`] : []),
    ],
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
  // A clean read-only run leaves nothing to review: remove its worktree and branch so checkouts do not pile up. That
  // includes a read-only run that was canceled or timed out (its process group is already gone); a boundary violation
  // or a failure keeps its worktree for review.
  if ((status === "succeeded" || status === "canceled" || status === "timed_out") && capabilityRank(req.capability) <= capabilityRank("L1") && files.length === 0) {
    const rm = await git(repo, ["worktree", "remove", "--force", worktree]);
    const del = rm.ok ? await git(repo, ["branch", "-D", branch]) : rm;
    if (rm.ok && del.ok) { result.worktree = null; result.branch = null; } else result.warnings.push("the read-only worktree could not be removed");
  }
  return finishWith(result);
}
