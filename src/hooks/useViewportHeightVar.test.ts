/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useViewportHeightVar } from "./useViewportHeightVar";

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--cc-vvh");
  vi.unstubAllGlobals();
});

function stubVisualViewport(height: number) {
  const listeners = new Set<() => void>();
  const vv = {
    height,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    fire: () => listeners.forEach((fn) => fn()),
    listenerCount: () => listeners.size,
  };
  vi.stubGlobal("visualViewport", vv);
  return vv;
}

describe("useViewportHeightVar", () => {
  it("writes the visible viewport height, not the layout height", () => {
    stubVisualViewport(412);
    renderHook(() => useViewportHeightVar());
    expect(document.documentElement.style.getPropertyValue("--cc-vvh")).toBe("412px");
  });

  it("follows the keyboard opening and closing", () => {
    const vv = stubVisualViewport(800);
    renderHook(() => useViewportHeightVar());
    expect(document.documentElement.style.getPropertyValue("--cc-vvh")).toBe("800px");

    // keyboard opens: the visible area shrinks, layout height does not
    vv.height = 420;
    act(() => vv.fire());
    expect(document.documentElement.style.getPropertyValue("--cc-vvh")).toBe("420px");

    vv.height = 800;
    act(() => vv.fire());
    expect(document.documentElement.style.getPropertyValue("--cc-vvh")).toBe("800px");
  });

  it("stops listening when the surface unmounts", () => {
    const vv = stubVisualViewport(640);
    const { unmount } = renderHook(() => useViewportHeightVar());
    expect(vv.listenerCount()).toBeGreaterThan(0);
    unmount();
    expect(vv.listenerCount()).toBe(0);
  });

  it("falls back to innerHeight when visualViewport is unavailable", () => {
    vi.stubGlobal("visualViewport", undefined);
    vi.stubGlobal("innerHeight", 700);
    renderHook(() => useViewportHeightVar());
    expect(document.documentElement.style.getPropertyValue("--cc-vvh")).toBe("700px");
  });
});
