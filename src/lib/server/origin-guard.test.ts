import { describe, expect, it } from "vitest";
import { trustedOrigins, verifyExactOrigin } from "./origin-guard";

const TRUSTED = "https://command.parallaxvinc.com";
const env = { PARALLAX_TRUSTED_ORIGINS: `${TRUSTED},http://localhost:3000` };

const withOrigin = (v?: string | null, extra: Record<string, string> = {}) =>
  new Request("https://command.parallaxvinc.com/api/x", {
    method: "POST",
    headers: { ...(v == null ? {} : { origin: v }), ...extra },
  });

describe("trustedOrigins", () => {
  it("rejects malformed configuration as a whole", () => {
    expect(trustedOrigins({ PARALLAX_TRUSTED_ORIGINS: "https://a.com:443/x, nonsense, ,http://b.com" }))
      .toEqual([]);
  });
  it("is empty when unset", () => expect(trustedOrigins({})).toEqual([]));
});

describe("verifyExactOrigin", () => {
  it("allows an exact trusted origin", () => {
    expect(verifyExactOrigin(withOrigin(TRUSTED), env)).toMatchObject({ ok: true });
  });

  it("denies when no trusted origins are configured", () => {
    expect(verifyExactOrigin(withOrigin(TRUSTED), {})).toMatchObject({
      ok: false, reason: "origin_not_configured", status: 503,
    });
  });

  it("denies missing, empty, duplicate and null origins", () => {
    expect(verifyExactOrigin(withOrigin(null), env)).toMatchObject({ reason: "origin_missing" });
    expect(verifyExactOrigin(withOrigin("   "), env)).toMatchObject({ reason: "origin_missing" });
    expect(verifyExactOrigin(withOrigin(`${TRUSTED}, https://evil.com`), env)).toMatchObject({
      reason: "origin_duplicate",
    });
    expect(verifyExactOrigin(withOrigin("null"), env)).toMatchObject({ reason: "origin_malformed" });
  });

  it("denies lookalikes, scheme, port and subdomain variants", () => {
    const bad = [
      "https://command.parallaxvinc.com.evil.com",
      "https://command.parallaxvinc.com:8443",
      "http://command.parallaxvinc.com",
      "https://evil-command.parallaxvinc.com",
      "https://command.parallaxvinc.com.",
      "https://user@command.parallaxvinc.com",
      "https://command.parallaxvinc.com/path",
      "https://command.parallaxvinc.com?x=1",
      "data:text/html,x",
      "not a url",
    ];
    for (const o of bad) {
      expect(verifyExactOrigin(withOrigin(o), env).ok, o).toBe(false);
    }
  });

  it("never falls back to Referer", () => {
    const r = verifyExactOrigin(
      withOrigin(null, { referer: `${TRUSTED}/command-center` }),
      env
    );
    expect(r).toMatchObject({ ok: false, reason: "origin_missing" });
    const r2 = verifyExactOrigin(
      withOrigin("https://evil.com", { referer: `${TRUSTED}/command-center` }),
      env
    );
    expect(r2).toMatchObject({ ok: false, reason: "origin_untrusted" });
  });

  it("never trusts x-forwarded-host", () => {
    const r = verifyExactOrigin(
      withOrigin("https://evil.com", { "x-forwarded-host": "command.parallaxvinc.com" }),
      env
    );
    expect(r.ok).toBe(false);
  });
});
