import { describe, it, expect, vi, afterEach } from "vitest";

describe("bridge-handlers fsUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("builds Firestore REST path with project id", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "my-proj");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
    const { fsUrl } = await import("./bridge-handlers");
    const u = fsUrl("config/features");
    expect(u).toContain("projects/my-proj");
    expect(u).toContain("documents/config/features");
    expect(u).not.toContain("key=");
  });

  it("appends ?key= when path has no query", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "p");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "secret+key");
    const { fsUrl } = await import("./bridge-handlers");
    const u = fsUrl("a/b");
    expect(u).toContain("?key=");
    expect(u).toContain(encodeURIComponent("secret+key"));
  });

  it("uses &key= when path already contains ?", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "p");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "k");
    const { fsUrl } = await import("./bridge-handlers");
    const u = fsUrl("x?filter=1");
    expect(u).toContain("&key=");
  });

  it("falls back to default project id when env is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
    const { fsUrl } = await import("./bridge-handlers");
    expect(fsUrl("c")).toContain("projects/apex-athlete-73755");
  });
});
