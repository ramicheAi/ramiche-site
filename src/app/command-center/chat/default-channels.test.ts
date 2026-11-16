import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { chatAgentIds } from "@/lib/agent-registry-core";

/**
 * CC-ORG-INTELLIGENCE-01 / CC-ORG-FOUNDATION-02 Phase B.
 *
 * `page.tsx` is a "use client" page that pulls in React, next/image,
 * react-markdown, the Supabase browser client, VoiceButton, etc. — too
 * heavy and environment-sensitive to import directly in a unit test, and
 * this repo's existing tests (agent-registry.test.ts, chat-persistence.test.ts,
 * provider-adapter.test.ts) already use this same static-source-read pattern
 * for exactly that reason. So this reads the file as text and extracts the
 * `members: [...]` arrays rather than importing the module.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

function extractDefaultChannelsMemberIds(source: string): string[] {
  const start = source.indexOf("const DEFAULT_CHANNELS = [");
  if (start === -1) throw new Error("DEFAULT_CHANNELS not found in page.tsx — did it get renamed?");
  // DEFAULT_CHANNELS is a top-level array literal; the next top-level
  // `const X = ` at column 0 marks the start of the following declaration.
  const rest = source.slice(start + "const DEFAULT_CHANNELS = [".length);
  const end = rest.search(/\n\];/);
  if (end === -1) throw new Error("Could not find the end of the DEFAULT_CHANNELS array literal");
  const block = rest.slice(0, end);

  const ids: string[] = [];
  const membersBlockRe = /members:\s*\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = membersBlockRe.exec(block)) !== null) {
    const inner = m[1] ?? "";
    const idRe = /"([a-z][a-z0-9_-]*)"/g;
    let idMatch: RegExpExecArray | null;
    while ((idMatch = idRe.exec(inner)) !== null) ids.push(idMatch[1]!);
  }
  return ids;
}

describe("DEFAULT_CHANNELS membership (CC-ORG-FOUNDATION-02 Phase B)", () => {
  const source = read("src/app/command-center/chat/page.tsx");
  const memberIds = extractDefaultChannelsMemberIds(source);
  const knownAgentIds = new Set(chatAgentIds());

  it("extracted at least one member id from every team channel (sanity check on the extractor)", () => {
    // 10 team channels today, 4-5 members each including atlas.
    expect(memberIds.length).toBeGreaterThanOrEqual(10 * 2);
  });

  it("every DEFAULT_CHANNELS member id is a real, chat-eligible agent id", () => {
    const unknown = memberIds.filter((id) => !knownAgentIds.has(id));
    expect(unknown).toEqual([]);
  });

  it("every DEFAULT_CHANNELS entry is tagged bootstrapMode: true (additive tag, CC-ORG-FOUNDATION-02)", () => {
    const start = source.indexOf("const DEFAULT_CHANNELS = [");
    const rest = source.slice(start + "const DEFAULT_CHANNELS = [".length);
    const end = rest.search(/\n\];/);
    const block = rest.slice(0, end);
    const entryLines = block
      .split("\n")
      .filter((line) => line.trim().startsWith("{") && line.includes("id:"));
    expect(entryLines.length).toBeGreaterThan(0);
    for (const line of entryLines) {
      expect(line, line).toMatch(/bootstrapMode:\s*true/);
    }
  });
});
