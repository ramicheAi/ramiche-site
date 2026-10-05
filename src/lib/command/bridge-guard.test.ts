/** P06 M5: the legacy Supabase chat bridge never relays a Universal Command shadow record to an agent. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isShadowCommand } from "../../../scripts/lib/shadow-guard.mjs";

describe("chat bridge shadow guard", () => {
  it("recognises shadow records by metadata kind, shadow flag, or the command channel", () => {
    expect(isShadowCommand({ metadata: { kind: "universal_command_shadow" } }, "general")).toBe(true);
    expect(isShadowCommand({ metadata: { shadow: true } }, "general")).toBe(true);
    expect(isShadowCommand({ metadata: {} }, "Universal Command (shadow)")).toBe(true);
    expect(isShadowCommand({ metadata: { source: "command-center-ui" } }, "general")).toBe(false);
    expect(isShadowCommand({ metadata: null }, undefined)).toBe(false);
  });
  it("the bridge checks it before any agent call", () => {
    const src = readFileSync(join(process.cwd(), "scripts/chat-bridge.mjs"), "utf8");
    const fn = src.slice(src.indexOf("async function handleNewMessage"), src.indexOf("// Main"));
    const guard = fn.indexOf("isShadowCommand(msg, channelCache.get(msg.channel_id))");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(fn.indexOf("callAgent("));
    expect(fn.slice(guard, guard + 80)).toMatch(/\)\) return;/);
  });
});
