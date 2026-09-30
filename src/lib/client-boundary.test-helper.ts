/**
 * Test helper: which "use client" files can transitively import a given module?
 * Shared by the agent-registry and provider-adapter boundary tests.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

function resolveSpec(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(from, "..", spec);
  else return null;
  for (const c of [base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx"), base]) {
    if (existsSync(join(process.cwd(), c)) && statSync(join(process.cwd(), c)).isFile()) return c;
  }
  return null;
}

function importsOf(f: string): string[] {
  const src = read(f);
  const out: string[] = [];
  // `import x from "m"`, `export * from "m"`, dynamic `import("m")` and side-effect `import "m"`.
  const re = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    const r = resolveSpec(m[1] ?? m[2] ?? m[3], f);
    if (r) out.push(r);
  }
  return out;
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(join(process.cwd(), dir))) {
    const rel = join(dir, n);
    const st = statSync(join(process.cwd(), rel));
    if (st.isDirectory()) walk(rel, acc);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) && !/\.test-helper\./.test(n)) acc.push(rel);
  }
  return acc;
}

export function clientFiles(): string[] {
  return walk("src").filter((f) => /^\s*["']use client["']/.test(read(f)));
}

/** "use client" files that can reach `target` through any chain of imports. */
export function clientFilesReaching(target: string): string[] {
  const offenders: string[] = [];
  for (const cf of clientFiles()) {
    const seen = new Set<string>();
    const stack = [cf];
    while (stack.length) {
      const f = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      if (f === target) {
        offenders.push(cf);
        break;
      }
      stack.push(...importsOf(f));
    }
  }
  return offenders;
}
