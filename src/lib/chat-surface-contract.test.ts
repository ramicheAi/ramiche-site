import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * Source-level contract tests for the two chat surfaces that have no runtime harness.
 *
 * Both chat pages are large client components with no test of their own, so two real fixes have no
 * way to fail if someone reverts them: the legacy console showing the relay's sentence instead of
 * its machine code, and the main page refusing locally when there is no message id to claim. An
 * independent review mutated both back and the whole suite still passed.
 *
 * These assertions are deliberately narrow and about structure, not formatting. They are a tripwire,
 * not a substitute for rendering the page: if either page grows a test harness, delete this file.
 */

const ROOT = join(__dirname, "..");

function source(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

describe("chat surfaces without a runtime harness", () => {
  it("the legacy console renders the relay's sentence, not its code", () => {
    const src = source("app/command-center/legacy/page.tsx");
    // It dispatches with no persisted message id, so the route refuses by design; the page must
    // explain that rather than show "relay_not_deployed".
    expect(src).toContain("relayErrorMessage(data, res.status)");
    expect(src).not.toMatch(/message:\s*data\.error\s*\|\|/);
  });

  it("the main chat page does not dispatch when there is no id to claim", () => {
    const src = source("app/command-center/chat/page.tsx");
    // The no-database branch used to call runRelay() with no argument, which the route now refuses.
    // Firing that request is a wasted round trip and a misleading error shape.
    const elseBranch = src.slice(src.indexOf("} else {\n      // No browser database client"));
    expect(elseBranch.length).toBeGreaterThan(0);
    const upToRelay = elseBranch.slice(0, elseBranch.indexOf("}"));
    expect(upToRelay).not.toContain("runRelay()");
    expect(src).toContain("could not be saved or claimed");
  });

  it("the chat page shows the relay's sentence through the shared helper", () => {
    const src = source("app/command-center/chat/page.tsx");
    expect(src).toContain("relayErrorMessage(parsed, r.status)");
    // The approve stream gets no per-frame HTTP status.
    expect(src).toContain('relayErrorMessage(data, 0, "Approve stream error")');
  });
});
