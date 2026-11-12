/**
 * Next keeps the FIRST value set for a header key, and rules from next.config are applied in
 * order with later matches overriding earlier ones. The handler-set CSP on the preview route
 * is dropped on the wire, so the sandbox CSP MUST come from a next.config rule that is the
 * LAST matching rule for each untrusted-content path (review of 8b253339).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ withSentryConfig: (c: unknown) => c }));

describe("untrusted preview paths get the sandbox CSP from the final matching next.config rule", () => {
  it.each(["/yolo-builds/x/index.html", "/api/command-center/yolo-builds/preview/x/index.html"])("%s", async (path) => {
    const cfg = (await import("../../next.config")).default as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> };
    const rules = await cfg.headers();
    const toRe = (s: string) => new RegExp("^" + s.replace(/:path\*/g, ".*").replace(/\(\.\*\)/g, ".*") + "$");
    let csp: string | undefined;
    for (const r of rules) {
      if (!toRe(r.source).test(path)) continue;
      const h = r.headers.find((x) => x.key === "Content-Security-Policy");
      if (h) csp = h.value;
    }
    expect(csp).toMatch(/^sandbox allow-scripts;/);
    expect(csp).toContain("connect-src 'none'");
    expect(csp).not.toMatch(/allow-same-origin/);
  });
});
