import { describe, expect, it } from "vitest";

import { relayErrorMessage } from "./relay-error-message";

describe("relayErrorMessage", () => {
  it("prefers the sentence the route wrote for a person over the machine code", () => {
    // This is the difference between "relay_not_deployed" and an operator knowing that nothing ran.
    const msg = relayErrorMessage(
      {
        ok: false,
        error: "relay_not_deployed",
        detail:
          "The relay's deduplication function is not installed on this database, so no agent turn was dispatched. Nothing ran. This needs a deployment fix, not a retry.",
      },
      503,
    );
    expect(msg).toContain("Nothing ran");
    expect(msg).not.toContain("relay_not_deployed");
  });

  it("falls back to the code when there is no detail", () => {
    expect(relayErrorMessage({ ok: false, error: "relay_unavailable" }, 503)).toBe("relay_unavailable");
  });

  it("does not print a non-string detail or an empty one", () => {
    expect(relayErrorMessage({ error: "relay_unavailable", detail: { text: "x" } }, 503)).toBe("relay_unavailable");
    expect(relayErrorMessage({ error: "relay_unavailable", detail: "   " }, 503)).toBe("relay_unavailable");
  });

  it("still says something useful for a 502 with a gateway message", () => {
    // The uncertain-acceptance path: the gateway's own error string is the only detail there is.
    const msg = relayErrorMessage(
      { error: "Gateway returned no reply text (check sessions_send policy / timeout)" },
      502,
    );
    expect(msg).toContain("no reply text");
  });

  it("names the status when the body is empty or not JSON", () => {
    // A 502 HTML page parses to nothing; the operator must not see a blank error.
    expect(relayErrorMessage(null, 502)).toBe("Chat relay failed (502)");
    expect(relayErrorMessage({}, 400)).toBe("Chat relay failed (400)");
  });

  it("does not render a bogus status for an SSE frame", () => {
    // The approval stream has no HTTP status per frame; "Approve stream error (0)" would be noise.
    expect(relayErrorMessage({}, undefined, "Approve stream error")).toBe("Approve stream error");
    expect(relayErrorMessage({}, 0, "Approve stream error")).toBe("Approve stream error");
  });

  it("never returns an empty string", () => {
    for (const body of [null, undefined, {}, { detail: "" }, { error: "" }, 0, "text"]) {
      expect(relayErrorMessage(body, 500).length).toBeGreaterThan(0);
    }
  });
});
