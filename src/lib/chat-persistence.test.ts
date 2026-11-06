import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { sanitizeDbError, summarizePersistence, type PersistenceFailure } from "./chat-persistence";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/* ── 1. error sanitising ─────────────────────────────────────────────── */
describe("sanitizeDbError", () => {
  it("keeps a PostgREST code and message", () => {
    expect(sanitizeDbError({ code: "42P01", message: 'relation "messages" does not exist' })).toEqual({
      code: "42P01",
      message: 'relation "messages" does not exist',
    });
  });

  it("joins message, details and hint like the Supabase client reports them", () => {
    const out = sanitizeDbError({ message: "insert failed", details: "bad column", hint: "check schema" });
    expect(out.message).toBe("insert failed | bad column | check schema");
  });

  it("accepts a thrown string", () => {
    expect(sanitizeDbError("fetch failed")).toEqual({ message: "fetch failed" });
  });

  it("has a usable fallback for values with no message", () => {
    expect(sanitizeDbError(undefined).message).toBe("unknown persistence error");
    expect(sanitizeDbError({ code: 500 }).message).toBe("unknown persistence error");
  });

  it("redacts connection strings, Supabase keys, JWTs and bearer tokens", () => {
    const out = sanitizeDbError({
      message:
        "connect postgres://user:pass@db.example.com:5432/app failed with sb_secret_AbCdEf123 " +
        "and eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnop " +
        "Authorization: Bearer sk-live-123 apikey=sb_publishable_XYZ123",
    });
    expect(out.message).not.toContain("user:pass");
    expect(out.message).not.toContain("sb_secret_AbCdEf123");
    expect(out.message).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(out.message).not.toContain("sk-live-123");
    expect(out.message).toContain("postgres://<redacted>");
    expect(out.message).toContain("sb_secret_<redacted>");
    expect(out.message).toContain("<jwt-redacted>");
  });

  it("collapses newlines and truncates long messages", () => {
    const out = sanitizeDbError({ message: `${"x".repeat(500)}\n\nnext` });
    expect(out.message.length).toBeLessThanOrEqual(201);
    expect(out.message).not.toContain("\n");
  });
});

/* ── 2. turn-level verdict ───────────────────────────────────────────── */
describe("summarizePersistence", () => {
  const fail = (agent: string): PersistenceFailure => ({ agent, message: "boom" });

  it("is ok when nothing was attempted (no database configured for the turn)", () => {
    expect(summarizePersistence(0, [])).toEqual({
      attempted: 0,
      persisted: 0,
      failed: 0,
      ok: true,
      failures: [],
    });
  });

  it("is ok when at least one write landed", () => {
    const summary = summarizePersistence(2, [fail("synthesis")]);
    expect(summary).toMatchObject({ attempted: 2, persisted: 1, failed: 1, ok: true });
    expect(summary.failures).toHaveLength(1);
  });

  it("is not ok when every attempted write failed — the dead-database case", () => {
    const summary = summarizePersistence(2, [fail("atlas"), fail("synthesis")]);
    expect(summary).toMatchObject({ attempted: 2, persisted: 0, failed: 2, ok: false });
  });

  it("never reports more writes than it attempted", () => {
    expect(summarizePersistence(1, [fail("a"), fail("b")]).persisted).toBe(0);
  });
});

/* ── 3. route wiring (structural) ────────────────────────────────────── */
describe("chat route persistence wiring", () => {
  const route = read("src/app/api/command-center/chat/route.ts");

  it("marks every agent reply with whether it was really persisted", () => {
    expect(route).toContain("persisted: replyPersisted");
    expect(route).toContain("if (!persistence.ok)");
    expect(route).toContain("status: 503");
  });

  it("records agent-reply and synthesis insert failures instead of only logging them", () => {
    expect(route).toMatch(/insertErr[\s\S]{0,400}persistenceFailures\.push/);
    expect(route).toMatch(/synthErr[\s\S]{0,400}persistenceFailures\.push/);
  });

  it("marks the synthesis card as persisted only when a row id came back", () => {
    expect(route).toContain("synthesisPersisted = true");
    expect(route).toContain("persisted: synthesisPersisted");
  });
});

describe("stream route persistence wiring", () => {
  const stream = read("src/app/api/command-center/chat/stream/route.ts");

  it("emits persist_error and a persisted flag instead of a silent null messageId", () => {
    expect(stream).toContain('send("persist_error"');
    expect(stream).toContain("persisted }");
    expect(stream).toContain("sanitizeDbError");
  });
});
