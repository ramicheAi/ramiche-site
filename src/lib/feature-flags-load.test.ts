import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { fbGetMock } = vi.hoisted(() => ({
  fbGetMock: vi.fn().mockResolvedValue({
    billing: false,
    meetManagement: false,
  }),
}));

vi.mock("./firebase", () => ({
  hasConfig: true,
  fbGet: (...args: unknown[]) => fbGetMock(...args),
}));

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

describe("feature-flags loadFlags", () => {
  beforeEach(() => {
    vi.resetModules();
    fbGetMock.mockResolvedValue({
      billing: false,
      meetManagement: false,
    });
    const ls = makeLocalStorage();
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { localStorage: ls });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadFlags merges remote config into getFlags", async () => {
    const { loadFlags, getFlags } = await import("./feature-flags");
    await loadFlags();
    const flags = getFlags();
    expect(flags.billing).toBe(false);
    expect(flags.meetManagement).toBe(false);
    expect(flags.swimcloudImport).toBe(true);
  });

  it("loadFlags swallows fbGet errors and keeps defaults", async () => {
    fbGetMock.mockRejectedValueOnce(new Error("network"));
    const { loadFlags, getFlags } = await import("./feature-flags");
    await loadFlags();
    const flags = getFlags();
    expect(flags.billing).toBe(true);
    expect(flags.meetManagement).toBe(true);
  });
});
