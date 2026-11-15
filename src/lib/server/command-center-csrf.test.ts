import { describe, expect, it } from "vitest";
import { checkBrowserMutation } from "./command-center-csrf";

const h = (o: Record<string, string>) => new Headers(o);
const ENV = {};

describe("checkBrowserMutation", () => {
  it("never restricts safe methods", () => {
    expect(checkBrowserMutation("GET", h({ "sec-fetch-site": "cross-site" }), ENV)).toEqual({ ok: true });
    expect(checkBrowserMutation("HEAD", h({}), ENV)).toEqual({ ok: true });
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "post"])("%s: same-origin Sec-Fetch-Site is allowed", (m) => {
    expect(checkBrowserMutation(m, h({ "sec-fetch-site": "same-origin" }), ENV)).toEqual({ ok: true });
  });

  it.each(["cross-site", "same-site", "none"])("rejects Sec-Fetch-Site: %s", (v) => {
    expect(checkBrowserMutation("POST", h({ "sec-fetch-site": v, origin: "http://localhost", host: "localhost" }), ENV)).toEqual({ ok: false, reason: "cross_site" });
  });

  it("allows Origin matching Host when Sec-Fetch-Site is absent", () => {
    expect(checkBrowserMutation("POST", h({ origin: "https://command.example.com", host: "command.example.com" }), ENV)).toEqual({ ok: true });
  });

  it("rejects Origin that does not match Host", () => {
    expect(checkBrowserMutation("POST", h({ origin: "https://evil.example.com", host: "command.example.com" }), ENV)).toEqual({ ok: false, reason: "origin_mismatch" });
  });

  it("rejects the literal null origin and malformed origins", () => {
    expect(checkBrowserMutation("POST", h({ origin: "null", host: "localhost" }), ENV)).toEqual({ ok: false, reason: "origin_mismatch" });
    expect(checkBrowserMutation("POST", h({ origin: "not a url", host: "localhost" }), ENV)).toEqual({ ok: false, reason: "origin_mismatch" });
  });

  it("rejects when neither Origin nor Sec-Fetch-Site is present (ambiguous)", () => {
    expect(checkBrowserMutation("POST", h({ host: "localhost" }), ENV)).toEqual({ ok: false, reason: "missing_origin" });
  });

  it("rejects CONFLICTING evidence: same-origin Sec-Fetch-Site + foreign Origin", () => {
    expect(checkBrowserMutation("POST", h({ "sec-fetch-site": "same-origin", origin: "https://evil.example.com", host: "command.example.com" }), ENV)).toEqual({ ok: false, reason: "origin_mismatch" });
  });

  it("rejects conflicting evidence: cross-site Sec-Fetch-Site + matching Origin", () => {
    expect(checkBrowserMutation("POST", h({ "sec-fetch-site": "cross-site", origin: "https://command.example.com", host: "command.example.com" }), ENV)).toEqual({ ok: false, reason: "cross_site" });
  });

  it("ignores spoofed forwarding headers entirely", () => {
    // Origin claims the trusted domain; only forwarding headers agree. Host does not.
    const res = checkBrowserMutation(
      "POST",
      h({ origin: "https://command.parallaxvinc.com", host: "localhost:3000", "x-forwarded-host": "command.parallaxvinc.com", forwarded: "host=command.parallaxvinc.com" }),
      ENV
    );
    expect(res).toEqual({ ok: false, reason: "origin_mismatch" });
  });

  it("accepts an explicitly configured allowed origin (tunnel host rewrite), nothing else", () => {
    const env = { CC_ALLOWED_ORIGINS: "https://command.parallaxvinc.com, junk, javascript:x" };
    const base = { host: "127.0.0.1:3000" };
    expect(checkBrowserMutation("POST", h({ ...base, origin: "https://command.parallaxvinc.com" }), env)).toEqual({ ok: true });
    expect(checkBrowserMutation("POST", h({ ...base, origin: "https://other.parallaxvinc.com" }), env)).toEqual({ ok: false, reason: "origin_mismatch" });
  });
});
