/**
 * The execution UI is client code mounted in the command palette: it must never pull node-only modules (node:crypto,
 * child_process, fs) into the browser bundle. A dev server cannot bundle them, which breaks every page with the
 * palette (found in M6E: ExecutionCards imported contract.ts, which imports node:crypto).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const dir = join(process.cwd(), "src/components/command-center/execution");
const clientFiles = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => join(dir, f));

it("execution UI imports only the client-safe contract, never node-only modules or server execution code", () => {
  for (const f of clientFiles) {
    const src = readFileSync(f, "utf8");
    expect(src, f).not.toMatch(/from\s+["']node:/);
    expect(src, f).not.toMatch(/from\s+["']@\/lib\/execution\/(contract|executor|claude-code|git|store|reaper|service|http|approval|policy|supabase-jobs-db)["']/);
  }
});

it("contract-core has no imports at all (constants and types only)", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/execution/contract-core.ts"), "utf8");
  expect(src).not.toMatch(/^\s*import\s/m);
});
