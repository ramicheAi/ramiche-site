/**
 * CC-SECURITY-REMEDIATION-05 item 7: `middleware.ts`'s comment on the
 * /command-center + /api/command-center gate previously claimed this was
 * reachable "ONLY ... NEVER the public *.vercel.app alias". That is not true --
 * the check reads the client-supplied `x-forwarded-host`/`host` header, which a
 * direct request to the public alias can set to anything. Reproduced here: a
 * request with no real presence on command.*, localhost, or the tailnet passes
 * the check purely by sending the right header value.
 */
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function req(pathname: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://ramiche-site.vercel.app${pathname}`, { headers });
}

describe("middleware: /api/command-center host gate is not a security boundary", () => {
  it("a request with no spoofed host header is rejected (today's actual behavior)", async () => {
    const res = await middleware(req("/api/command-center/gate"));
    expect(res.status).toBe(404);
  });

  it("CC-SECURITY-REMEDIATION-05 item 7: a forged x-forwarded-host header alone passes the gate", async () => {
    const res = await middleware(req("/api/command-center/gate", { "x-forwarded-host": "command.anything-i-want.example" }));
    expect(res.status).not.toBe(404);
  });

  it("a forged Host header alone (no x-forwarded-host) also passes the gate", async () => {
    const res = await middleware(req("/api/command-center/gate", { host: "command.anything-i-want.example" }));
    expect(res.status).not.toBe(404);
  });

  it("a forged *.ts.net value also passes, with no actual tailnet presence", async () => {
    const res = await middleware(req("/api/command-center/gate", { host: "literally-anything.ts.net" }));
    expect(res.status).not.toBe(404);
  });
});
