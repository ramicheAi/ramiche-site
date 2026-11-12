import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Agent-generated builds under public/ are served statically with the global CSP (no sandbox).
// Header rules match the raw path, so encoded paths (/%79olo-builds/...) bypass the sandbox rule.
it("public/yolo-builds must not exist or must be empty", () => {
  const d = join(process.cwd(), "public", "yolo-builds");
  expect(existsSync(d) ? readdirSync(d) : []).toEqual([]);
});
