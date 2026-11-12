import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdToken, retrieve, create } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  retrieve: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({ verifyIdToken }));
vi.mock("stripe", () => ({
  default: class {
    customers = { retrieve };
    billingPortal = { sessions: { create } };
  },
}));

import { POST } from "./route";

const req = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/stripe/portal", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));

describe("POST /api/stripe/portal — never opens another customer's billing portal", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    verifyIdToken.mockReset();
    retrieve.mockReset();
    create.mockReset();
  });

  it("rejects a request with no token", async () => {
    const res = await req({ customerId: "cus_victim" });
    expect(res.status).toBe(401);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("rejects an invalid/expired token", async () => {
    verifyIdToken.mockResolvedValue(null);
    const res = await req({ customerId: "cus_victim" }, { authorization: "Bearer bad" });
    expect(res.status).toBe(401);
  });

  it("an authenticated caller cannot open another customer's portal (IDOR closed)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "attacker-uid", email: "attacker@example.com" });
    retrieve.mockResolvedValue({ email: "victim@example.com" });
    const res = await req({ customerId: "cus_victim" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("the customer's own portal session is created with a server-controlled return_url, ignoring a forged Origin", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com" });
    retrieve.mockResolvedValue({ email: "owner@example.com" });
    create.mockResolvedValue({ url: "https://billing.stripe.com/p/session_x" });
    const res = await req({ customerId: "cus_owner" }, { authorization: "Bearer good", origin: "https://evil.example.com" });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ return_url: expect.not.stringContaining("evil.example.com") }));
  });

  it("a deleted customer is treated as not found", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com" });
    retrieve.mockResolvedValue({ deleted: true });
    const res = await req({ customerId: "cus_x" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
  });
});
