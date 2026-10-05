#!/usr/bin/env node
/**
 * P06 M6 test double for the Claude Code CLI. It speaks the same stream-json, but it is a model that IGNORES its
 * permissions: it performs whatever the plan in the prompt says (writes, shell commands, commits, pushes, sleeps), so
 * the tests prove the boundary is enforced by the executor and git, not by the model's good behaviour.
 *
 * The prompt (stdin) carries `FAKE:{...}` with { actions: [{write, content} | {bash} | {sleep} | {spawnSleep}],
 * result, isError, exit }. FAKE_CLAUDE_RECORD (test env) receives argv, cwd and environment variable names.
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const prompt = readFileSync(0, "utf8");
if (process.env.FAKE_CLAUDE_RECORD) {
  writeFileSync(process.env.FAKE_CLAUDE_RECORD, JSON.stringify({ argv, cwd: process.cwd(), envKeys: Object.keys(process.env).sort(), prompt }));
}
const m = prompt.match(/FAKE:(\{[\s\S]*\})\s*$/);
const plan = m ? JSON.parse(m[1]) : { actions: [], result: "Nothing to do." };
const emit = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const toolsAt = argv.indexOf("--tools");
emit({ type: "system", subtype: "init", model: "fake-claude-model", cwd: process.cwd(), tools: toolsAt >= 0 ? argv[toolsAt + 1].split(",") : [] });

let n = 0;
for (const a of plan.actions ?? []) {
  if (a.write) { mkdirSync(dirname(a.write), { recursive: true }); writeFileSync(a.write, a.content ?? "changed\n"); }
  if (a.bash) {
    const id = `toolu_${n++}`;
    emit({ type: "assistant", message: { content: [{ type: "tool_use", id, name: "Bash", input: { command: a.bash } }] } });
    let ok = true, out = "";
    try { out = execSync(a.bash, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], shell: "/bin/sh" }).toString(); }
    catch (e) { ok = false; out = String(e.stderr || e.message); }
    emit({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: !ok, content: out.slice(0, 300) }] } });
  }
  if (a.spawnSleep) {
    const c = spawn("sleep", [String(a.spawnSleep)], { stdio: "ignore" });
    if (process.env.FAKE_CLAUDE_CHILD) writeFileSync(process.env.FAKE_CLAUDE_CHILD, String(c.pid));
  }
  if (a.sleep) await new Promise((r) => setTimeout(r, a.sleep));
}
emit({
  type: "result", subtype: plan.isError ? "error_during_execution" : "success", is_error: !!plan.isError,
  result: plan.result ?? "Done.", num_turns: (plan.actions ?? []).length + 1, total_cost_usd: 0.0123, usage: { input_tokens: 1200, output_tokens: 80 },
});
process.exit(plan.exit ?? 0);
