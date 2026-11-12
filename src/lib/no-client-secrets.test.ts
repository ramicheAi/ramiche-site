import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|jsx|mjs)$/.test(n) ? [p] : [];
  });
}
const files = walk(SRC).filter((f) => !/\.test\.(ts|tsx)$/.test(f));

describe("no secret reaches a browser bundle", () => {
  it("the old hardcoded bridge secret literal appears nowhere in src", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("parallax-bridge-2026"));
    expect(hits).toEqual([]);
  });

  it("no 'use client' module or page under command-center names a bridge/server secret", () => {
    const bad = files.filter((f) => {
      const s = readFileSync(f, "utf8");
      const client = /^\s*["']use client["']/m.test(s.slice(0, 400));
      return client && /x-bridge-secret|BRIDGE_API_SECRET|CC_PUSH_SECRET|TELEGRAM_WEBHOOK_SECRET|VAPI_WEBHOOK_SECRET|OPENCLAW_GATEWAY_TOKEN/.test(s);
    });
    expect(bad).toEqual([]);
  });

  it("no command-center page (client or not) sends an x-bridge-secret header", () => {
    const pages = files.filter((f) => f.includes(`${join("src", "app", "command-center")}`) || f.includes("/app/command-center/"));
    expect(pages.filter((f) => readFileSync(f, "utf8").includes("x-bridge-secret"))).toEqual([]);
  });
});
