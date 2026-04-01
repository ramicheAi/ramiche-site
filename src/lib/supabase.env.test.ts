import { describe, it, expect, vi, afterEach } from "vitest";

describe("supabase with env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("creates client when URL and anon key are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyzcompany.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
    );
    const { supabase } = await import("./supabase");
    expect(supabase).not.toBeNull();
    expect(typeof supabase?.from).toBe("function");
  });

  it("returns null when URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
    );
    const { supabase } = await import("./supabase");
    expect(supabase).toBeNull();
  });

  it("returns null when anon key is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyzcompany.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { supabase } = await import("./supabase");
    expect(supabase).toBeNull();
  });
});
