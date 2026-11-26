/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBriefing } from "./useBriefing";

/**
 * Before this round, the hook tracked only `source` ("deterministic" | "atlas") — there was no
 * way to tell a briefing composed one second ago from a localStorage-cached one up to 12 hours
 * old, and the UI's single `lastUpdated` timestamp described the underlying FACTS refresh, never
 * the spoken text itself. These tests pin `provenance` and `composedAt` answering that correctly
 * for each of the states CC-RELEASE-CONSOLIDATION-01 Phase 3 asked for: fresh, cached, and
 * deterministic-fallback-with-a-real-reason.
 */

vi.mock("@/lib/voice-playback", () => ({
  playVoiceReply: vi.fn(() => ({ done: Promise.resolve(), stop: vi.fn() })),
}));

// This Node/jsdom combination's own `window.localStorage` throws ("--localstorage-file was not
// provided") rather than behaving like a browser's, so the hook's own try/catch around every
// localStorage call swallows it — not a bug in the hook, just an environment gap these tests need
// to close with a plain in-memory polyfill, same contract (get/set/remove on strings) the hook uses.
function installLocalStoragePolyfill(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

const AGENTS_BODY = { agents: [], count: 2, activeCount: 2 };
const REVENUE_BODY = { subscriptions: { mrr: 1000, arr: 12000 }, revenue: { last30Days: 500 } };
const CALENDAR_BODY = { events: [] };

function okJson(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

/** Routes the three facts endpoints to canned bodies; anything else falls through to `extra`. */
function mockFetch(extra: (url: string, init?: RequestInit) => Promise<Response> | null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/agents")) return okJson(AGENTS_BODY);
    if (url.includes("/revenue")) return okJson(REVENUE_BODY);
    if (url.includes("/calendar")) return okJson(CALENDAR_BODY);
    const r = extra(url, init);
    if (r) return r;
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("useBriefing provenance", () => {
  beforeEach(() => {
    installLocalStoragePolyfill();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks a briefing composed by a live call as fresh, not cached", async () => {
    global.fetch = mockFetch((url) => {
      if (url.includes("/briefing/compose")) {
        return Promise.resolve(
          okJson({ ok: true, source: "atlas", greeting: "Hi", spoken: "Hi there.", bullets: ["x"] }),
        );
      }
      return null;
    });
    const { result } = renderHook(() => useBriefing());
    await waitFor(() => expect(result.current.source).toBe("atlas"));
    expect(result.current.provenance).toBe("fresh");
    expect(result.current.composedAt).not.toBeNull();
    expect(result.current.fallbackReason).toBeNull();
  });

  it("marks a briefing loaded from the localStorage cache as cached, with the cache's own timestamp — not now", async () => {
    const cachedAt = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;
    window.localStorage.setItem(
      "cc-briefing-compose-cache",
      JSON.stringify({
        date: dateKey,
        cachedAt,
        spoken: "Cached brief.",
        bullets: ["cached bullet"],
        greeting: "Cached greeting",
        source: "atlas",
      }),
    );
    global.fetch = mockFetch(() => null); // compose must not be called while a valid cache exists
    const { result } = renderHook(() => useBriefing());
    await waitFor(() => expect(result.current.source).toBe("atlas"));
    expect(result.current.provenance).toBe("cached");
    expect(result.current.composedAt).toBe(cachedAt);
  });

  it("carries the real server reason when it falls back to deterministic, not a fabricated one", async () => {
    global.fetch = mockFetch((url) => {
      if (url.includes("/briefing/compose")) {
        return Promise.resolve(
          okJson({
            ok: true,
            source: "deterministic",
            reason: "empty_reply",
            greeting: "Hi",
            spoken: "Deterministic spoken.",
            bullets: ["x"],
          }),
        );
      }
      return null;
    });
    const { result } = renderHook(() => useBriefing());
    await waitFor(() => expect(result.current.fallbackReason).toBe("empty_reply"));
    expect(result.current.source).toBe("deterministic");
    expect(result.current.provenance).toBe("fresh");
  });

  it("does not leave a stale fresh/cached provenance attached when the compose request itself fails", async () => {
    global.fetch = mockFetch((url) => {
      if (url.includes("/briefing/compose")) return Promise.reject(new Error("network down"));
      return null;
    });
    const { result } = renderHook(() => useBriefing());
    await waitFor(() => expect(result.current.fallbackReason).toBe("compose_request_failed"));
    expect(result.current.source).toBe("deterministic");
    expect(result.current.provenance).toBe("fresh");
    expect(result.current.briefing).not.toBeNull(); // the always-on deterministic composer still renders something
  });

  it("regenerate() clears the fallback reason and marks the next attempt fresh immediately", async () => {
    let composeCallCount = 0;
    global.fetch = mockFetch((url) => {
      if (url.includes("/briefing/compose")) {
        composeCallCount += 1;
        if (composeCallCount === 1) {
          return Promise.resolve(
            okJson({ ok: true, source: "deterministic", reason: "gateway_not_configured", greeting: "Hi", spoken: "D.", bullets: ["x"] }),
          );
        }
        return Promise.resolve(
          okJson({ ok: true, source: "atlas", greeting: "Hi", spoken: "Atlas now.", bullets: ["x"] }),
        );
      }
      return null;
    });
    const { result } = renderHook(() => useBriefing());
    await waitFor(() => expect(result.current.fallbackReason).toBe("gateway_not_configured"));

    await result.current.regenerate();
    await waitFor(() => expect(result.current.source).toBe("atlas"));
    expect(result.current.fallbackReason).toBeNull();
    expect(result.current.provenance).toBe("fresh");
  });

  it("reports the real reason — not silence — when compose answers with an HTTP error", async () => {
    // Independent review found this exact path (res.ok === false) previously returned with no
    // state change at all, which left whatever fallbackReason/source/provenance already existed
    // in place — indistinguishable from the normal, by-design "no gateway configured" case.
    global.fetch = mockFetch((url) => {
      if (url.includes("/briefing/compose")) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
      }
      return null;
    });
    const { result } = renderHook(() => useBriefing());
    await waitFor(() => expect(result.current.fallbackReason).toBe("http_500"));
    expect(result.current.source).toBe("deterministic");
    expect(result.current.provenance).toBe("fresh");
  });

  it("clears a stale cached Atlas override when a later regenerate attempt fails, instead of leaving mismatched state", async () => {
    // Independent review found that on failure, `source` flipped to "deterministic" but `override`
    // (the actual text behind `composed = override ?? baseline`) was never cleared — so a prior
    // successful Atlas override kept rendering while the badge claimed "Deterministic".
    let composeCallCount = 0;
    global.fetch = mockFetch((url) => {
      if (url.includes("/briefing/compose")) {
        composeCallCount += 1;
        if (composeCallCount === 1) {
          return Promise.resolve(
            okJson({ ok: true, source: "atlas", greeting: "Hi", spoken: "First atlas reply.", bullets: ["x"] }),
          );
        }
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response);
      }
      return null;
    });
    const { result } = renderHook(() => useBriefing());
    await waitFor(() => expect(result.current.source).toBe("atlas"));
    expect(result.current.briefing?.spoken).toBe("First atlas reply.");

    await result.current.regenerate();
    await waitFor(() => expect(result.current.source).toBe("deterministic"));
    expect(result.current.fallbackReason).toBe("http_500");
    // The stale Atlas text must be gone — what's on screen must match what `source` claims.
    expect(result.current.briefing?.spoken).not.toBe("First atlas reply.");
  });
});
