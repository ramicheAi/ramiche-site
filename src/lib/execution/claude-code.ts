/**
 * P06 M6 Claude Code adapter: runs the Claude Code CLI headless for one ExecutionRequest, inside a prepared worktree.
 *
 * It does not use the claude-max proxy (which runs every request with --dangerously-skip-permissions and no working
 * directory). It spawns the CLI directly with an exact tool set, dontAsk permissions, no settings files, no MCP and no
 * skills, a stripped environment, and the prompt on stdin (never in argv, so it is not visible in a process list).
 * The process runs in its own group so a timeout or cancel stops everything it started.
 */
import { spawn, type SpawnOptions } from "node:child_process";
import { appendFileSync } from "node:fs";
import { CAPABILITY_META, type Capability, type ExecutionCheck } from "./contract";
import { cliPolicy, executionEnv, type CliPolicy } from "./policy";

export interface ClaudeRunOptions {
  bin: string;
  cwd: string;
  capability: Capability;
  instruction: string;
  projectName: string;
  maxTurns: number;
  maxBudgetUsd: number | null;
  model: string | null;
  timeoutMs: number;
  signal?: AbortSignal;
  logPath: string;
  /** Called once with the CLI's own pid (process evidence for the reaper). */
  onSpawn?: (pid: number) => void;
  /** Tests only: extra variables for a fake CLI. Never secrets. */
  extraEnv?: Record<string, string>;
  spawnImpl?: typeof spawn;
}

export interface ClaudeRunOutcome {
  exitCode: number | null;
  timedOut: boolean;
  canceled: boolean;
  reportedError: boolean;
  resultText: string;
  modelReported: string | null;
  turns: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimateUsd: number | null;
  checks: ExecutionCheck[];
  sawResult: boolean;
}

export function systemPrompt(capability: Capability, projectName: string): string {
  return [
    `You are running a Parallax OS task for the ${projectName} project, in an isolated git worktree on its own branch.`,
    `Granted capability: ${capability} (${CAPABILITY_META[capability].label}). Stay within it.`,
    "Never push, open pull requests, merge, deploy, run migrations, change credentials, contact anyone, or change production systems: those need separate approval and will fail here.",
    "Work only inside this directory. When done, reply with a short plain summary (one to three sentences) of what you found or changed, and which checks you ran.",
  ].join("\n");
}

export function claudeArgs(o: Pick<ClaudeRunOptions, "capability" | "cwd" | "projectName" | "maxTurns" | "maxBudgetUsd" | "model">, policy: CliPolicy = cliPolicy(o.capability, o.cwd)): string[] {
  const args = [
    "-p", "--output-format", "stream-json", "--verbose", "--no-session-persistence",
    "--permission-mode", "dontAsk", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
    "--tools", policy.tools.join(","),
    "--allowedTools", ...policy.allowedTools,
    "--disallowedTools", ...policy.disallowedTools,
    "--max-turns", String(o.maxTurns),
    "--append-system-prompt", systemPrompt(o.capability, o.projectName),
  ];
  if (o.model) args.push("--model", o.model);
  if (o.maxBudgetUsd !== null) args.push("--max-budget-usd", String(o.maxBudgetUsd));
  return args;
}

const KILL_GRACE_MS = 5000;
const MAX_LOG_BYTES = 8 * 1024 * 1024;
const MAX_LINE_BYTES = 4 * 1024 * 1024;

export function runClaudeCode(o: ClaudeRunOptions): Promise<ClaudeRunOutcome> {
  const out: ClaudeRunOutcome = {
    exitCode: null, timedOut: false, canceled: false, reportedError: false, resultText: "", modelReported: null, turns: null,
    inputTokens: null, outputTokens: null, costEstimateUsd: null, checks: [], sawResult: false,
  };
  let logged = 0;
  const log = (line: string) => {
    if (logged > MAX_LOG_BYTES) return;
    const text = (line.endsWith("\n") ? line : line + "\n");
    logged += text.length;
    try { appendFileSync(o.logPath, logged > MAX_LOG_BYTES ? JSON.stringify({ type: "parallax", event: "log_truncated" }) + "\n" : text); } catch { /* logging never stops a run */ }
  };
  const pendingBash = new Map<string, string>();

  const onEvent = (m: Record<string, unknown>) => {
    if (m.type === "system" && m.subtype === "init" && typeof m.model === "string") out.modelReported = m.model;
    const content = (m.message as { content?: unknown } | undefined)?.content;
    if (m.type === "assistant" && Array.isArray(content)) {
      for (const c of content as Record<string, unknown>[]) {
        if (c.type === "tool_use" && c.name === "Bash" && typeof c.id === "string") pendingBash.set(c.id, String((c.input as { command?: unknown })?.command ?? ""));
      }
    }
    if (m.type === "user" && Array.isArray(content)) {
      for (const c of content as Record<string, unknown>[]) {
        if (c.type === "tool_result" && typeof c.tool_use_id === "string" && pendingBash.has(c.tool_use_id)) {
          out.checks.push({ command: pendingBash.get(c.tool_use_id)!.slice(0, 300), ok: c.is_error !== true });
          pendingBash.delete(c.tool_use_id);
        }
      }
    }
    if (m.type === "result") {
      out.sawResult = true;
      out.reportedError = m.is_error === true || (typeof m.subtype === "string" && m.subtype !== "success");
      out.resultText = typeof m.result === "string" ? m.result : "";
      out.turns = typeof m.num_turns === "number" ? m.num_turns : null;
      out.costEstimateUsd = typeof m.total_cost_usd === "number" ? m.total_cost_usd : null;
      const u = m.usage as Record<string, unknown> | undefined;
      out.inputTokens = typeof u?.input_tokens === "number" ? u.input_tokens : null;
      out.outputTokens = typeof u?.output_tokens === "number" ? u.output_tokens : null;
    }
  };

  return new Promise((resolve) => {
    const opts: SpawnOptions = { cwd: o.cwd, env: { ...executionEnv(), ...(o.extraEnv ?? {}) } as NodeJS.ProcessEnv, detached: true, stdio: ["pipe", "pipe", "pipe"] };
    const child = (o.spawnImpl ?? spawn)(o.bin, claudeArgs(o), opts);
    if (child.pid) { try { o.onSpawn?.(child.pid); } catch { /* evidence only */ } }
    let buf = "";
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const killGroup = (sig: NodeJS.Signals) => {
      try { if (child.pid) process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* already gone */ } }
    };
    const stop = (why: "timeout" | "cancel") => {
      if (why === "timeout") out.timedOut = true; else out.canceled = true;
      log(JSON.stringify({ type: "parallax", event: why, at: new Date().toISOString() }));
      killGroup("SIGTERM");
      killTimer = setTimeout(() => killGroup("SIGKILL"), KILL_GRACE_MS);
    };
    const timer = setTimeout(() => stop("timeout"), o.timeoutMs);
    const onAbort = () => stop("cancel");
    if (o.signal?.aborted) onAbort(); else o.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout?.on("data", (d: Buffer) => {
      buf += d.toString("utf8");
      if (buf.length > MAX_LINE_BYTES && buf.indexOf("\n") < 0) { log(JSON.stringify({ type: "parallax", event: "oversized_line_dropped" })); buf = ""; }
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        log(line);
        try { onEvent(JSON.parse(line)); } catch { /* a non-JSON line is kept in the log only */ }
      }
    });
    child.stderr?.on("data", (d: Buffer) => log(JSON.stringify({ type: "parallax", event: "stderr", text: d.toString("utf8").slice(0, 2000) })));
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      killGroup("SIGKILL");   // anything the CLI left running in its group
      o.signal?.removeEventListener("abort", onAbort);
      if (buf.trim()) { log(buf); try { onEvent(JSON.parse(buf)); } catch { /* ignore */ } }
      out.exitCode = code;
      resolve(out);
    };
    child.on("error", (e) => { log(JSON.stringify({ type: "parallax", event: "spawn_error", message: String(e.message).slice(0, 300) })); finish(null); });
    // A process the CLI started can keep the pipes open after the CLI exits: stop the group so "close" arrives.
    child.on("exit", () => killGroup("SIGKILL"));
    child.on("close", (code) => finish(code));
    child.stdin?.on("error", () => { /* the CLI may exit before reading */ });
    child.stdin?.end(o.instruction);
  });
}
