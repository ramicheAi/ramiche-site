/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRealtimeRoster, useRealtimeConfig } from "./use-realtime-sync";

const syncListenRoster = vi.fn(() => () => {});
const syncListenConfig = vi.fn(() => () => {});

vi.mock("./apex-sync", () => ({
  syncListenRoster: (...args: unknown[]) => syncListenRoster(...args),
  syncListenConfig: (...args: unknown[]) => syncListenConfig(...args),
}));

describe("use-realtime-sync", () => {
  beforeEach(() => {
    syncListenRoster.mockImplementation(() => () => {});
    syncListenConfig.mockImplementation(() => () => {});
  });
  it("useRealtimeRoster registers listener when groupId is set", () => {
    renderHook(() => useRealtimeRoster("group-1", "ls-roster", vi.fn()));
    expect(syncListenRoster).toHaveBeenCalledWith(
      "ls-roster",
      "group-1",
      expect.any(Function)
    );
  });

  it("useRealtimeRoster skips when groupId is null", () => {
    syncListenRoster.mockClear();
    renderHook(() => useRealtimeRoster(null, "ls-roster", vi.fn()));
    expect(syncListenRoster).not.toHaveBeenCalled();
  });

  it("useRealtimeConfig registers listener when configKey is set", () => {
    renderHook(() => useRealtimeConfig<string>("pin", "ls-cfg", vi.fn()));
    expect(syncListenConfig).toHaveBeenCalledWith(
      "ls-cfg",
      "pin",
      expect.any(Function)
    );
  });

  it("useRealtimeConfig skips when configKey is null", () => {
    syncListenConfig.mockClear();
    renderHook(() => useRealtimeConfig<string>(null, "ls-cfg", vi.fn()));
    expect(syncListenConfig).not.toHaveBeenCalled();
  });

  it("useRealtimeRoster unsubscribes on unmount", () => {
    const unsub = vi.fn();
    syncListenRoster.mockReturnValue(unsub);
    const { unmount } = renderHook(() =>
      useRealtimeRoster("group-1", "ls-roster", vi.fn())
    );
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it("useRealtimeConfig unsubscribes on unmount", () => {
    const unsub = vi.fn();
    syncListenConfig.mockReturnValue(unsub);
    const { unmount } = renderHook(() =>
      useRealtimeConfig<string>("pin", "ls-cfg", vi.fn())
    );
    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
