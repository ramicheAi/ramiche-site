import { describe, it, expect } from "vitest";
import { sanitize, sanitizeWithLimit, isValidEmail } from "./sanitize";

describe("sanitize (client)", () => {
  it("removes script tags and strips HTML", () => {
    expect(sanitize('<script>alert(1)</script>hi')).toBe("hi");
    expect(sanitize("<p>ok</p>")).toBe("ok");
  });

  it("sanitizeWithLimit truncates", () => {
    expect(sanitizeWithLimit("abcdef", 3)).toBe("abc");
  });

  it("sanitizeWithLimit yields empty when maxLength is 0", () => {
    expect(sanitizeWithLimit("hello", 0)).toBe("");
  });

  it("sanitizeWithLimit sanitizes before truncating", () => {
    expect(sanitizeWithLimit("<b>abcdef</b>", 3)).toBe("abc");
  });

  it("isValidEmail validates basic shape", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
    expect(isValidEmail("no-at-sign")).toBe(false);
  });

  it("isValidEmail rejects missing domain segment", () => {
    expect(isValidEmail("a@b")).toBe(false);
  });

  it("isValidEmail rejects surrounding whitespace", () => {
    expect(isValidEmail(" a@b.co")).toBe(false);
    expect(isValidEmail("a@b.co ")).toBe(false);
  });

  it("returns empty for empty or non-string input", () => {
    expect(sanitize("")).toBe("");
    expect(sanitize(null as unknown as string)).toBe("");
  });

  it("trims outer whitespace after stripping tags", () => {
    expect(sanitize("  <p>x</p>  ")).toBe("x");
  });

  it("strips javascript: and inline event handlers", () => {
    expect(sanitize('href="javascript:alert(1)"')).not.toMatch(/javascript/i);
    expect(sanitize("<div onclick=alert(1)>x</div>")).not.toMatch(/onclick/i);
  });
});
