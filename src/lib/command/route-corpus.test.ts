/**
 * P06 M5: the adversarial routing corpus (fixtures/route-corpus.ts). Each command must reach exactly its expected
 * handler; every founder-authority entry must carry a founder_authority / security reason and require approval.
 */
import { describe, expect, it } from "vitest";
import { routeCommand } from "./router";
import { ROUTE_CORPUS } from "./fixtures/route-corpus";

describe("adversarial routing corpus", () => {
  it("is substantial and covers every probe group", () => {
    expect(ROUTE_CORPUS.length).toBeGreaterThanOrEqual(140);
    expect(new Set(ROUTE_CORPUS.map((e) => e.group))).toEqual(new Set(["git", "approval", "mission", "comms", "money", "data", "security", "named", "negation", "noun", "code", "explicit", "deterministic", "ambiguous"]));
    expect(new Set(ROUTE_CORPUS.map((e) => e.text.toLowerCase())).size).toBe(ROUTE_CORPUS.length);
  });

  it.each(ROUTE_CORPUS.map((e) => [e.group, e.text, e] as const))("[%s] %s", (_g, text, e) => {
    const d = routeCommand({ text });
    expect(d.handler).toBe(e.expect);
    if (e.reviewer !== undefined) expect(d.reviewer).toBe(e.reviewer);
    if (e.expect === "human") {
      expect(d.reasons[0]).toMatch(/^(founder_authority_|security_or_authorization)/);
      expect(d.founderApprovalRequired).toBe(true);
      expect(d.missionRecommended).toBe(false);
    }
    expect(d.mergeAuthority).toBe("founder");
    expect(d.classifier).toBeNull();
  });
});
