import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./firebase", () => ({ hasConfig: false }));

import { reportError, initErrorReporting } from "./error-reporter";

describe("error-reporter", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: { href: "http://x/apex-athlete/coach", pathname: "/apex-athlete/coach" },
    });
    vi.stubGlobal("navigator", { userAgent: "ua" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs structured report", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("e"));
    expect(spy).toHaveBeenCalled();
  });

  it("string errors omit stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError("plain");
    const report = spy.mock.calls[0][1] as { message: string; stack?: string };
    expect(report.message).toBe("plain");
    expect(report.stack).toBeUndefined();
  });

  it("detects parent portal from pathname", () => {
    vi.stubGlobal("window", {
      location: { href: "http://x/parent/kid", pathname: "/parent/kid" },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("e"));
    const report = spy.mock.calls[0][1] as { portal?: string };
    expect(report.portal).toBe("parent");
  });

  it("detects athlete portal from pathname", () => {
    vi.stubGlobal("window", {
      location: { href: "http://x/athlete/me", pathname: "/athlete/me" },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("e"));
    const report = spy.mock.calls[0][1] as { portal?: string };
    expect(report.portal).toBe("athlete");
  });

  it("detects coach portal from /coach pathname", () => {
    vi.stubGlobal("window", {
      location: { href: "http://x/coach", pathname: "/coach/dashboard" },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("e"));
    const report = spy.mock.calls[0][1] as { portal?: string };
    expect(report.portal).toBe("coach");
  });

  it("reports portal other for unmatched paths", () => {
    vi.stubGlobal("window", {
      location: { href: "http://x/about", pathname: "/about" },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportError(new Error("e"));
    const report = spy.mock.calls[0][1] as { portal?: string };
    expect(report.portal).toBe("other");
  });

  it("initErrorReporting registers error and unhandledrejection handlers", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const listeners: Record<string, (e: unknown) => void> = {};
    vi.stubGlobal("window", {
      location: { href: "http://x/other", pathname: "/other" },
      addEventListener: vi.fn((type: string, fn: (e: unknown) => void) => {
        listeners[type] = fn;
      }),
    });
    initErrorReporting();
    expect(listeners.error).toBeDefined();
    expect(listeners.unhandledrejection).toBeDefined();

    listeners.error({
      error: new Error("from-error-event"),
      message: "fallback",
      filename: "f.ts",
      lineno: 1,
      colno: 2,
    });
    listeners.unhandledrejection({
      reason: new Error("from-rejection"),
    });
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
