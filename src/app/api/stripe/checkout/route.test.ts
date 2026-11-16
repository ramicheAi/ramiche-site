import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdToken, create } = vi.hoisted(() => ({ verifyIdToken: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifyIdToken }));
vi.mock("stripe", () => ({ default: class { checkout = { sessions: { create } }; } }));

import { POST } from "./route";

const req = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));

describe("POST /api/stripe/checkout — anonymous flow unchanged, token optional and binding", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    verifyIdToken.mockReset();
    create.mockReset().mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_x" });
  });

  it("an anonymous checkout (today's only real caller, no Authorization header) still works and carries no firebaseUid", async () => {
    const res = await req({ priceId: "price_starter_monthly" });
    expect(res.status).toBe(200);
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ metadata: { planId: "starter" } }));
  });

  it("a signed-in caller's verified uid is attached to the session metadata", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com" });
    const res = await req({ priceId: "price_starter_monthly" }, { authorization: "Bearer good" });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ metadata: { planId: "starter", firebaseUid: "owner-uid" } }));
  });

  it("an invalid token is silently treated as anonymous (never forged, never a 401)", async () => {
    verifyIdToken.mockResolvedValue(null);
    const res = await req({ priceId: "price_starter_monthly" }, { authorization: "Bearer bad" });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ metadata: { planId: "starter" } }));
  });
});
