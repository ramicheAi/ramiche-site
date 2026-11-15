/**
 * @vitest-environment jsdom
 */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useFinanceTruth } from "./useFinanceTruth";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("useFinanceTruth", () => {
  it("reports unavailable, not an empty ledger, when the endpoint fails", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });
    const { result } = renderHook(() => useFinanceTruth());
    await waitFor(() => expect(result.current.source).toBe("unavailable"));
    expect(result.current.mrr).toBeNull();
    expect(result.current.reason || "").toBeTruthy();
  });

  it("keeps the labelled demo when the endpoint fails and demo was requested", async () => {
    window.history.replaceState({}, "", "/command-center/finance?demo=1");
    stubFetch(async () => {
      throw new Error("network down");
    });
    const { result } = renderHook(() => useFinanceTruth());
    await waitFor(() => expect(result.current.source).toBe("demo"));
    expect(result.current.mrr).toBe(48200);
    expect(result.current.measuredAt).toBeNull();
  });

  it("treats a non-2xx answer as unavailable rather than parsing it as data", async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const { result } = renderHook(() => useFinanceTruth());
    await waitFor(() => expect(result.current.source).toBe("unavailable"));
    expect(result.current.mrr).toBeNull();
  });
});
