#!/usr/bin/env node
// Test double for the Claude Code CLI: records argv + stdin, emits one result line.
import fs from "node:fs";
let stdin = "";
process.stdin.on("data", (c) => (stdin += c));
process.stdin.on("end", () => {
  fs.writeFileSync(process.env.FAKE_CLI_OUT, JSON.stringify({ argv: process.argv.slice(2), stdin }));
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", result: "ok" }) + "\n");
});
