/** The router's project-name list must never drift from the real project registry it stands in for (purity note above). */
import { describe, expect, it } from "vitest";
import { REPO_REGISTRY } from "@/lib/execution/projects";
import { KNOWN_PROJECT_ALIASES } from "./known-project-names";

describe("known-project-names mirrors the execution registry exactly", () => {
  it("is the same set of alias words, with no drift in either direction", () => {
    const real = new Set(REPO_REGISTRY.flatMap((e) => e.aliases));
    expect(new Set(KNOWN_PROJECT_ALIASES)).toEqual(real);
  });
});
