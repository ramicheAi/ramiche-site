import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructEvent, update, adminWriteSubscription } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  update: vi.fn(),
  adminWriteSubscription: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/firebase-admin", () => ({ adminWriteSubscription, adminWriteConnectedAccount: vi.fn() }));
vi.mock("stripe", () => ({
  default: class {
    webhooks = { constructEvent };
    customers = { update };
  },
}));

import { POST } from "./route";

function session(overrides: Partial<{ metadata: Record<string, string> }> = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        customer: "cus_x",
        subscription: "sub_x",
        customer_details: { email: "owner@example.com" },
        metadata: { planId: "starter", ...overrides.metadata },
      },
    },
  };
}
const post = () =>
  POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" }));

describe("checkout.session.completed stamps the verified uid onto the Stripe customer", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    constructEvent.mockReset();
    update.mockReset();
    adminWriteSubscription.mockClear();
  });

  it("stamps customer.metadata.firebaseUid when the checkout session carried one", async () => {
    constructEvent.mockReturnValue(session({ metadata: { firebaseUid: "owner-uid" } }));
    const res = await post();
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith("cus_x", { metadata: { firebaseUid: "owner-uid" } });
  });

  it("never stamps anything for an anonymous checkout (no firebaseUid in session metadata)", async () => {
    constructEvent.mockReturnValue(session());
    const res = await post();
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("a Stripe update failure never fails the webhook (subscription bookkeeping still happens)", async () => {
    constructEvent.mockReturnValue(session({ metadata: { firebaseUid: "owner-uid" } }));
    update.mockRejectedValue(new Error("stripe down"));
    const res = await post();
    expect(res.status).toBe(200);
    expect(adminWriteSubscription).toHaveBeenCalled();
  });
});
