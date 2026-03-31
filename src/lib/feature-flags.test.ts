import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./firebase", () => ({ hasConfig: false }));

function makeLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem(k: string) {
      return data.has(k) ? data.get(k)! : null;
    },
    setItem(k: string, v: string) {
      data.set(k, v);
    },
    removeItem(k: string) {
      data.delete(k);
    },
  } as Storage;
}

describe("feature-flags", () => {
  beforeEach(() => {
    vi.resetModules();
    const ls = makeLocalStorage();
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { localStorage: ls });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getFlags returns defaults when storage is empty", async () => {
    const { getFlags } = await import("./feature-flags");
    expect(getFlags().billing).toBe(true);
    expect(getFlags().pushNotifications).toBe(false);
  });

  it("getFlags merges localStorage JSON over defaults", async () => {
    const ls = globalThis.localStorage as Storage;
    ls.setItem(
      "mettle_feature_flags",
      JSON.stringify({ billing: false, swimcloudImport: false })
    );
    const { getFlags } = await import("./feature-flags");
    expect(getFlags().billing).toBe(false);
    expect(getFlags().swimcloudImport).toBe(false);
    expect(getFlags().meetManagement).toBe(true);
  });

  it("setFlag updates cache and storage", async () => {
    const { getFlags, setFlag, isEnabled } = await import("./feature-flags");
    setFlag("billing", false);
    expect(isEnabled("billing")).toBe(false);
    expect(getFlags().billing).toBe(false);
    const raw = globalThis.localStorage.getItem("mettle_feature_flags");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({ billing: false });
  });
});
