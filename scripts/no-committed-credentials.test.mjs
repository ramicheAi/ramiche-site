import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * No credential file may be tracked in this repository.
 *
 * WHY THIS EXISTS — 2026-11-16. `.parallax-publish-token` was committed here on
 * 2026-08-28 and stayed on `main` for eighty days. The file's own header argued
 * it was safe because the token cannot publish and "can live in a private repo".
 * That reasoning was sound and the premise was false: this repo is public, so
 * the token was served to anyone with the URL, no authentication required.
 *
 * A comment cannot enforce a premise. This can: the check reads what git
 * actually tracks, so a file added later is caught the day it lands.
 *
 * A tracked-by-mistake credential is not fixed by deleting it in the next
 * commit — it stays in history and in every clone. The only real fix is
 * rotation, which is why `docs/PUBLISH-TOKEN-CONTAINMENT.md` exists beside this.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Filenames that, if tracked, are a credential leak by definition. */
const FORBIDDEN = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(local|production|development|vercel|preview)$/,
  /(^|\/)[^/]*publish-token[^/]*$/,
  /(^|\/)[^/]*\.pem$/,
  /(^|\/)[^/]*\.(p12|pfx)$/,
  /(^|\/)id_(rsa|ed25519|ecdsa)$/,
  /(^|\/)service[-_]?account[^/]*\.json$/,
  /(^|\/)[^/]*\.keystore$/,
];

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

describe("no credential is committed", () => {
  it("git tracks no file that is a credential by name", () => {
    const hits = trackedFiles().filter((f) => FORBIDDEN.some((re) => re.test(f)));
    expect(
      hits,
      `These tracked files look like credentials. Remove them from tracking, ` +
        `rotate the values, and add them to .gitignore:\n  ${hits.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the publish token path is ignored, so a stray copy cannot be added by accident", () => {
    const ignored = readFileSync(resolve(ROOT, ".gitignore"), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    expect(ignored).toContain(".parallax-publish-token");
  });

  it("the creds helper reads the queue token from the environment only", () => {
    /* A file fallback is how the 2026-08-28 leak happened. If this assertion
       fails, someone has pointed the script back at a file in the tree. */
    const src = readFileSync(resolve(ROOT, "scripts/publish-creds.mjs"), "utf8");
    expect(src).not.toMatch(/readFileSync\([^)]*parallax-publish-token/);
    expect(src).toMatch(/QUEUE_KEYS\.map\(\(k\) => process\.env\[k\]\)/);
  });

  it("allowlisted non-secret env samples are still permitted", () => {
    /* Guards the guard: a future tightening must not start forbidding the
       documented example files that carry placeholder values only. */
    expect(FORBIDDEN.some((re) => re.test(".env.example"))).toBe(false);
    expect(FORBIDDEN.some((re) => re.test(".env.test"))).toBe(false);
  });
});
