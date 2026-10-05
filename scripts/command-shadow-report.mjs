#!/usr/bin/env node
/**
 * P06 M5 Universal Command shadow observation: OFFLINE, read-only report.
 *
 * It never connects to a database or a service. It reads files you give it (or the bundled routing corpus) and prints
 * counts. Requires Node 23.6+ (TypeScript type stripping); the resolve hook below only maps the repo's "@/" alias and
 * extensionless relative imports to .ts files.
 *
 *   node scripts/command-shadow-report.mjs --corpus                     the bundled corpus, labelled by its expectations
 *   node scripts/command-shadow-report.mjs --records export.json        exported command records (see the runbook)
 *   node scripts/command-shadow-report.mjs --records export.json --labels labels.json [--json]
 *
 * export.json: an array of rows from the read-only query in docs/p06/M5-SHADOW-OBSERVATION-RUNBOOK.md, or of records
 * as GET /api/command-center/command/shadow/:id returns them. labels.json: [{ "id": "...", "expect": "claude_code" }].
 */
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
registerHooks({
  resolve(specifier, context, next) {
    let target = null;
    if (specifier.startsWith("@/")) target = join(ROOT, "src", specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts")) {
      target = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target) {
      for (const candidate of [target, `${target}.ts`, join(target, "index.ts")]) {
        if (existsSync(candidate) && !candidate.endsWith("/")) {
          try { if (readFileSync(candidate)) return { url: pathToFileURL(candidate).href, format: candidate.endsWith(".ts") ? "module-typescript" : undefined, shortCircuit: true }; } catch { /* a directory */ }
        }
      }
    }
    return next(specifier, context);
  },
});

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
/** Exit codes: 0 clean, 1 a dangerous false negative (and only that), 2 a usage or input error. */
function usage(message) {
  console.error(`${message}\nusage: --corpus | --records <export.json> [--labels <labels.json>] [--json]`);
  process.exit(2);
}
function readJsonArray(p, what) {
  let v;
  try { v = JSON.parse(readFileSync(p, "utf8")); } catch (e) { usage(`cannot read ${what} ${p}: ${e instanceof Error ? e.message : e}`); }
  if (!Array.isArray(v)) usage(`${what} ${p} must be a JSON array`);
  return v;
}

const load = (rel) => import("@/" + rel);   // through the hook, so the entry files get the TypeScript format too
const { normalize, summarize, formatReport } = await load("lib/command/observation");

let records, labels = [], skipped = 0;
if (flag("--corpus")) {
  const { ROUTE_CORPUS } = await load("lib/command/fixtures/route-corpus");
  const { routeCommand } = await load("lib/command/router");
  records = ROUTE_CORPUS.map((e, i) => ({
    id: `corpus-${i}`, command: e.text, routedAt: "", supersedes: null, missionContext: null,
    decision: routeCommand({ text: e.text, handlerHint: e.hint ?? null }), linkedMissions: [],
  }));
  labels = ROUTE_CORPUS.map((e, i) => ({ id: `corpus-${i}`, expect: e.expect }));
} else if (value("--records")) {
  const n = normalize(readJsonArray(value("--records"), "records"));
  records = n.records; skipped = n.skipped;
  if (value("--labels")) {
    labels = readJsonArray(value("--labels"), "labels");
    if (!labels.every((l) => l && typeof l === "object" && typeof l.id === "string")) usage("each label must be an object with a string id");
  }
} else {
  usage("no input");
}

const summary = summarize(records, labels);
console.log(flag("--json") ? JSON.stringify(summary, null, 2) : formatReport(summary, skipped));
// A dangerous false negative is a failure of the safety invariant: make it visible to scripts too.
if (summary.labels !== "not labelled" && summary.labels.dangerousFalseNegatives.length > 0) process.exitCode = 1;
