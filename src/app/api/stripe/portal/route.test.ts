import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdToken, retrieve, update, create } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({ verifyIdToken }));
vi.mock("stripe", () => ({
  default: class {
    customers = { retrieve, update };
    billingPortal = { sessions: { create } };
  },
}));

import { POST } from "./route";

let ipCounter = 0;
const req = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/stripe/portal", {
    method: "POST",
    // Each test gets its own IP bucket — the in-memory rate limiter is otherwise
    // shared across every test in this file (no reset hook exists).
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipCounter}`, ...headers },
    body: JSON.stringify(body),
  }));

describe("POST /api/stripe/portal — uid mapping is authoritative, never email alone", () => {
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

  it("the mapped owner opens their own portal", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ email: "owner@example.com", metadata: { firebaseUid: "owner-uid" } });
    create.mockResolvedValue({ url: "https://billing.stripe.com/p/session_x" });
    const res = await req({ customerId: "cus_owner" }, { authorization: "Bearer good" });
    expect(res.status).toBe(200);
  });

  it("a DIFFERENT uid is denied even with the SAME email as the mapped owner (uid decides, not email)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "attacker-uid", email: "shared@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ email: "shared@example.com", metadata: { firebaseUid: "owner-uid" } });
    const res = await req({ customerId: "cus_owner" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("the mapped owner is still authorized after THEIR OWN email on the Stripe record changes (uid survives an email change)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner-new-email@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ email: "owner-old-email@example.com", metadata: { firebaseUid: "owner-uid" } });
    create.mockResolvedValue({ url: "https://billing.stripe.com/p/session_x" });
    const res = await req({ customerId: "cus_owner" }, { authorization: "Bearer good" });
    expect(res.status).toBe(200);
  });

  it("a mapped customer denies every other uid, even one whose email happens to equal the customer's CURRENT email", async () => {
    verifyIdToken.mockResolvedValue({ uid: "someone-else-uid", email: "victim@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ email: "victim@example.com", metadata: { firebaseUid: "owner-uid" } });
    const res = await req({ customerId: "cus_owner" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
  });

  it("falls back to email equality ONLY when the customer has no uid mapping yet (legacy data), and only if the caller's email is verified", async () => {
    verifyIdToken.mockResolvedValue({ uid: "legacy-uid", email: "legacy@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ email: "legacy@example.com", metadata: {} });
    create.mockResolvedValue({ url: "https://billing.stripe.com/p/session_x" });
    const res = await req({ customerId: "cus_legacy" }, { authorization: "Bearer good" });
    expect(res.status).toBe(200);
  });

  it("an UNVERIFIED email never satisfies the fallback — closes the sign-up-as-victim's-email takeover", async () => {
    verifyIdToken.mockResolvedValue({ uid: "attacker-uid", email: "victim@example.com", emailVerified: false });
    retrieve.mockResolvedValue({ email: "victim@example.com", metadata: {} });
    const res = await req({ customerId: "cus_legacy" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("a nonexistent customerId (Stripe throws resource_missing) is the same 404 shape, never 500", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com", emailVerified: true });
    retrieve.mockRejectedValue(Object.assign(new Error("No such customer"), { code: "resource_missing" }));
    const res = await req({ customerId: "cus_nonexistent" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
  });

  it("the email fallback still rejects a non-matching caller on an unmapped customer", async () => {
    verifyIdToken.mockResolvedValue({ uid: "attacker-uid", email: "attacker@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ email: "victim@example.com", metadata: {} });
    const res = await req({ customerId: "cus_legacy" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
  });

  it("the portal session is created with a server-controlled return_url, ignoring a forged Origin", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ email: "owner@example.com", metadata: { firebaseUid: "owner-uid" } });
    create.mockResolvedValue({ url: "https://billing.stripe.com/p/session_x" });
    const res = await req({ customerId: "cus_owner" }, { authorization: "Bearer good", origin: "https://evil.example.com" });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ return_url: expect.not.stringContaining("evil.example.com") }));
  });

  it("a deleted customer is treated as not found", async () => {
    verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "owner@example.com", emailVerified: true });
    retrieve.mockResolvedValue({ deleted: true });
    const res = await req({ customerId: "cus_x" }, { authorization: "Bearer good" });
    expect(res.status).toBe(404);
  });
});
