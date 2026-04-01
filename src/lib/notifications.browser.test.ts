/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getNotificationStatus, getStoredToken } from "./notifications";

function makeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(i: number) {
      return [...store.keys()][i] ?? null;
    },
    getItem(k: string) {
      return store.has(k) ? store.get(k)! : null;
    },
    setItem(k: string, v: string) {
      store.set(k, v);
    },
    removeItem(k: string) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
  } as Storage;
}

describe("notifications (jsdom)", () => {
  beforeEach(() => {
    const ls = makeLocalStorage();
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { ...globalThis, localStorage: ls, Notification: globalThis.Notification });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getNotificationStatus reflects Notification.permission", () => {
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "granted" },
      configurable: true,
    });
    expect(getNotificationStatus()).toBe("granted");
  });

  it("getNotificationStatus reflects denied", () => {
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "denied" },
      configurable: true,
    });
    expect(getNotificationStatus()).toBe("denied");
  });

  it("getNotificationStatus reflects default", () => {
    Object.defineProperty(globalThis, "Notification", {
      value: { permission: "default" },
      configurable: true,
    });
    expect(getNotificationStatus()).toBe("default");
  });

  it("getStoredToken reads apex-fcm-token", () => {
    localStorage.setItem("apex-fcm-token", "tok-xyz");
    expect(getStoredToken()).toBe("tok-xyz");
  });
});
