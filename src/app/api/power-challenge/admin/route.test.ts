import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * HOTFIX-SECURITY-001: the Power Challenge admin and export routes used to be guarded by a
 * hardcoded PIN compared with `!==`. The PIN was in this public-repository source, so the guard was
 * published rather than secret, and `STRIPE_SECRET_KEY` is set in production, so both routes worked
 * for anyone who read the repo.
 *
 * They are now wrapped in `ownerOnly`, the same owner-session guard the Command Center uses. These
 * tests prove three things: the wrapper is applied, the old PIN cannot authenticate, and the literal
 * is gone from the source so it cannot come back in a later edit.
 */

const { list, guardState } = vi.hoisted(() => ({
  list: vi.fn(),
  guardState: { owner: false },
}));

vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { list } };
  },
}));

// The real guard verifies a Firebase session cookie; that machinery has its own suite. Here the
// wrapper is replaced by one that models "owner signed in" so the route's own behaviour is testable.
vi.mock("@/lib/server/command-center-guard", () => ({
  ownerOnly:
    (handler: (req: Request) => Promise<Response>) =>
    async (req: Request) => {
      const header = req.headers.get("x-test-owner") === "yes";
      if (!guardState.owner && !header) {
        return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
      }
      return handler(req);
    },
}));

import { GET as adminGet } from "./route";
import { GET as exportGet } from "../export/route";

const session = (id: string) => ({
  id,
  created: 1_700_000_000,
  payment_status: "paid",
  customer_email: "athlete@example.test",
  metadata: {
    race: "500m",
    firstName: "Test",
    lastName: "Athlete",
    email: "athlete@example.test",
    phone: "000",
    dob: "1990-01-01",
    gender: "X",
    team: "Test",
    emergencyName: "E",
    emergencyPhone: "000",
    medical: "",
  },
});

// The wrapped handler is exported with zero declared parameters (it ignores the request); Next still
// passes one. Cast to the call shape the framework uses so the tests can exercise the URL and headers.
type Handler = (req: Request) => Promise<Response>;
const admin = adminGet as unknown as Handler;
const exporter = exportGet as unknown as Handler;

const adminReq = (headers: Record<string, string> = {}) =>
  admin(new Request("http://localhost/api/power-challenge/admin", { headers }));
const exportReq = (headers: Record<string, string> = {}, query = "") =>
  exporter(new Request(`http://localhost/api/power-challenge/export${query}`, { headers }));

describe("power-challenge admin/export require an owner session, not a PIN", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    guardState.owner = false;
    list.mockReset();
    list.mockResolvedValue({ data: [session("cs_1")], has_more: false });
  });

  it("admin route refuses an unauthenticated caller and touches no Stripe data", async () => {
    const res = await adminReq();
    expect(res.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("admin route ignores the old PIN header", async () => {
    const res = await adminReq({ "x-admin-pin": "PIRANHAS2026" });
    expect(res.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("admin route serves the owner", async () => {
    guardState.owner = true;
    const res = await adminReq();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.registrations[0].email).toBe("athlete@example.test");
  });

  it("export route refuses an unauthenticated caller", async () => {
    const res = await exportReq();
    expect(res.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("export route ignores a PIN supplied as a query string", async () => {
    const res = await exportReq({}, "?pin=PIRANHAS2026");
    expect(res.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("export route serves the owner as CSV", async () => {
    guardState.owner = true;
    const res = await exportReq();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain("athlete@example.test");
  });
});

describe("the published PIN cannot be reintroduced", () => {
  const root = process.cwd();
  const sources = [
    "src/app/api/power-challenge/admin/route.ts",
    "src/app/api/power-challenge/export/route.ts",
    "src/app/power-challenge/admin/page.tsx",
  ];

  it("no source file contains the old literal", () => {
    for (const rel of sources) {
      const text = readFileSync(`${root}/${rel}`, "utf8");
      expect(text, rel).not.toContain("PIRANHAS2026");
    }
  });

  it("no source file reads a pin header or a pin query parameter", () => {
    for (const rel of sources) {
      const text = readFileSync(`${root}/${rel}`, "utf8");
      expect(text, rel).not.toMatch(/x-admin-pin/);
      expect(text, rel).not.toMatch(/[?&]pin=/);
    }
  });
});
