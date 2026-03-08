import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const WORKSPACE = "/Users/admin/.openclaw/workspace";
const dir = join(WORKSPACE, "projects");
const entries = readdirSync(dir);

for (const e of entries) {
  if (e.startsWith(".") || e === "PRE-BUILD-CHECKLIST.md") continue;
  const p = join(dir, e);
  if (!statSync(p).isDirectory()) continue;

  const metaPath = join(p, "META.json");
  let meta = {};
  if (existsSync(metaPath)) {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  }

  const tasksPath = join(p, "TASKS.md");
  let taskCount = 0;
  let doneCount = 0;
  if (existsSync(tasksPath)) {
    const content = readFileSync(tasksPath, "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.match(/^-\s*\[x\]/i)) { taskCount++; doneCount++; }
      else if (line.match(/^-\s*\[\s\]/)) { taskCount++; }
    }
  }

  console.log(`${meta.name || e} | status: ${meta.status || "?"} | priority: ${meta.priority || "?"} | tasks: ${doneCount}/${taskCount}`);
}
