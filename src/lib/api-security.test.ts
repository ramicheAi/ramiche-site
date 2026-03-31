import { describe, it, expect, vi } from "vitest";
import {
  sanitize,
  isValidEmail,
  isOneOf,
  extractApiKey,
  verifyOrigin,
  generateNonce,
  parseBody,
  generateApiKeyPair,
  verifyRequestSignature,
  encryptSecret,
  decryptSecret,
  badRequest,
  forbidden,
  serverError,
} from "./api-security";

async function hmacSignature(
  secret: string,
  ts: string,
  nonce: string,
  method: string,
  path: string
): Promise<string> {
  const signingString = `${ts}:${nonce}:${method}:${path}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signingString));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("api-security", () => {
  it("sanitize strips tags and caps length", () => {
    expect(sanitize("<b>x</b>", 10)).toBe("x");
    expect(sanitize(123 as unknown as string)).toBe("");
  });

  it("isValidEmail validates shape and length", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("bad")).toBe(false);
    expect(isValidEmail("a@" + "x".repeat(300) + ".co")).toBe(false);
  });

  it("isOneOf narrows string union", () => {
    expect(isOneOf("a", ["a", "b"])).toBe(true);
    expect(isOneOf("c", ["a", "b"])).toBe(false);
  });

  it("extractApiKey reads Bearer, Apikey, or x-api-key", () => {
    expect(
      extractApiKey(new Request("http://x", { headers: { authorization: "Bearer tok" } }))
    ).toBe("tok");
    expect(
      extractApiKey(new Request("http://x", { headers: { authorization: "Apikey key2" } }))
    ).toBe("key2");
    expect(
      extractApiKey(new Request("http://x", { headers: { "x-api-key": "k3" } }))
    ).toBe("k3");
  });

  it("extractApiKey returns null when no key headers", () => {
    expect(extractApiKey(new Request("http://x"))).toBeNull();
  });

  it("verifyOrigin matches origin or referer prefix", () => {
    const req = new Request("http://x", { headers: { origin: "https://app.com" } });
    expect(verifyOrigin(req, ["https://app.com"])).toBe(true);
    expect(verifyOrigin(req, ["https://other.com"])).toBe(false);
  });

  it("verifyOrigin matches referer when origin is absent", () => {
    const req = new Request("http://x", {
      headers: { referer: "https://app.com/dashboard" },
    });
    expect(verifyOrigin(req, ["https://app.com"])).toBe(true);
  });

  it("verifyOrigin returns false when allowed list is empty", () => {
    const req = new Request("http://x", { headers: { origin: "https://app.com" } });
    expect(verifyOrigin(req, [])).toBe(false);
  });

  it("generateNonce returns 32 hex chars", () => {
    expect(generateNonce()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("parseBody parses JSON under size limit", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    const { data, error } = await parseBody(req);
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
  });

  it("parseBody rejects oversized body", async () => {
    const big = "x".repeat(20_000);
    const req = new Request("http://x", { method: "POST", body: big });
    const { error } = await parseBody(req, 100);
    expect(error).toBeTruthy();
  });

  it("parseBody returns error for invalid JSON", async () => {
    const req = new Request("http://x", { method: "POST", body: "not-json" });
    const { data, error } = await parseBody(req);
    expect(data).toBeNull();
    expect(error).toBe("Invalid JSON body");
  });

  it("parseBody rejects empty body", async () => {
    const req = new Request("http://x", { method: "POST", body: "" });
    const { data, error } = await parseBody(req);
    expect(data).toBeNull();
    expect(error).toBe("Invalid JSON body");
  });

  it("parseBody rejects when content-length exceeds max", async () => {
    const req = new Request("http://x", {
      method: "POST",
      headers: { "content-length": "50000" },
      body: "{}",
    });
    const { data, error } = await parseBody(req, 100);
    expect(data).toBeNull();
    expect(error).toBe("Request body too large");
  });

  it("generateApiKeyPair returns pk_/sk_ prefixes", () => {
    const pair = generateApiKeyPair();
    expect(pair.keyId.startsWith("pk_")).toBe(true);
    expect(pair.secretKey.startsWith("sk_")).toBe(true);
  });

  it("verifyRequestSignature rejects when headers missing", async () => {
    const req = new Request("http://localhost/api/x", { method: "POST" });
    const r = await verifyRequestSignature(req, "secret");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/Missing signature/);
  });

  it("verifyRequestSignature rejects expired timestamp", async () => {
    const stale = String(Date.now() - 400_000);
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: {
        "x-signature": "00",
        "x-timestamp": stale,
        "x-nonce": "n",
      },
    });
    const r = await verifyRequestSignature(req, "secret");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/timestamp/);
  });

  it("verifyRequestSignature rejects non-numeric timestamp", async () => {
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: {
        "x-signature": "00",
        "x-timestamp": "not-ts",
        "x-nonce": "n",
      },
    });
    const r = await verifyRequestSignature(req, "secret");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/timestamp/);
  });

  it("verifyRequestSignature rejects wrong HMAC", async () => {
    const ts = String(Date.now());
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: {
        "x-signature": "ab".repeat(32),
        "x-timestamp": ts,
        "x-nonce": "n1",
      },
    });
    const r = await verifyRequestSignature(req, "secret");
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("Invalid signature");
  });

  it("verifyRequestSignature accepts matching HMAC", async () => {
    const secret = "unit-test-secret";
    const ts = String(Date.now());
    const nonce = "nonce1";
    const path = "/api/x";
    const signature = await hmacSignature(secret, ts, nonce, "POST", path);
    const req = new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        "x-signature": signature,
        "x-timestamp": ts,
        "x-nonce": nonce,
      },
    });
    const r = await verifyRequestSignature(req, secret);
    expect(r.valid).toBe(true);
  });

  it("verifyRequestSignature applies custom maxAgeMs", async () => {
    vi.useFakeTimers();
    try {
      const now = Date.UTC(2026, 5, 15, 12, 0, 0);
      vi.setSystemTime(now);
      const secret = "unit-test-secret";
      const ts = String(now - 90_000);
      const nonce = "n";
      const path = "/api/x";
      const signature = await hmacSignature(secret, ts, nonce, "POST", path);
      const req = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
          "x-signature": signature,
          "x-timestamp": ts,
          "x-nonce": nonce,
        },
      });
      const narrow = await verifyRequestSignature(req, secret, 60_000);
      expect(narrow.valid).toBe(false);
      const wide = await verifyRequestSignature(req, secret, 120_000);
      expect(wide.valid).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("encryptSecret round-trips through decryptSecret", async () => {
    const enc = await encryptSecret("hello-world");
    const plain = await decryptSecret(enc);
    expect(plain).toBe("hello-world");
  });

  it("badRequest returns 400 JSON body", async () => {
    const res = badRequest("bad");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad" });
  });

  it("forbidden returns 403 with default message", async () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("forbidden accepts custom message", async () => {
    const res = forbidden("No access");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "No access" });
  });

  it("serverError returns 500", async () => {
    const res = serverError("oops");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "oops" });
  });

  it("serverError uses default message when omitted", async () => {
    const res = serverError();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
