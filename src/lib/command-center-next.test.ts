import { describe, expect, it } from "vitest";
import { COMMAND_CENTER_HOME, safeCommandCenterNext } from "./command-center-next";

describe("safeCommandCenterNext", () => {
  it("accepts same-origin Command Center paths (with query)", () => {
    expect(safeCommandCenterNext("/command-center")).toBe("/command-center");
    expect(safeCommandCenterNext("/command-center/leads")).toBe("/command-center/leads");
    expect(safeCommandCenterNext("/command-center/leads?id=4&tab=x")).toBe("/command-center/leads?id=4&tab=x");
  });

  it("defaults for missing/empty", () => {
    expect(safeCommandCenterNext(null)).toBe(COMMAND_CENTER_HOME);
    expect(safeCommandCenterNext(undefined)).toBe(COMMAND_CENTER_HOME);
    expect(safeCommandCenterNext("")).toBe(COMMAND_CENTER_HOME);
  });

  it.each([
    ["absolute external URL", "https://evil.example.com/command-center"],
    ["http absolute", "http://evil.example.com"],
    ["protocol-relative", "//evil.example.com/command-center"],
    ["protocol-relative with path", "//evil.example.com"],
    ["backslash host", "/\\evil.example.com"],
    ["backslash protocol-relative", "\\\\evil.example.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,x"],
    ["encoded protocol-relative", "%2F%2Fevil.example.com"],
    ["slash + encoded slash", "/%2Fevil.example.com"],
    ["encoded backslash", "/%5Cevil.example.com"],
    ["double-encoded protocol-relative", "/%252F%252Fevil.example.com"],
    ["triple+ encoded", "/%25252Fevil.example.com"],
    ["encoded newline", "/command-center%0d%0aLocation:%20https://evil.example.com"],
    ["raw tab", "/\tcommand-center"],
    ["other app area", "/coach/dashboard"],
    ["login loop", "/command-login"],
    ["api path", "/api/command-center/settings"],
    ["prefix lookalike", "/command-center-evil"],
    ["prefix lookalike 2", "/command-centerx/leads"],
    ["dot-dot escape", "/command-center/../coach"],
    ["encoded dot-dot escape", "/command-center/%2e%2e/coach"],
    ["whitespace prefix", " /command-center"],
    ["malformed percent", "/command-center/%E0%A4%A"],
  ])("rejects %s", (_name, v) => {
    expect(safeCommandCenterNext(v)).toBe(COMMAND_CENTER_HOME);
  });

  it("rejects oversized input", () => {
    expect(safeCommandCenterNext("/command-center/" + "a".repeat(3000))).toBe(COMMAND_CENTER_HOME);
  });
});
