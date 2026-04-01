import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  verifyIdToken,
  createSessionCookie,
  verifySessionCookie,
  adminWriteSubscription,
  adminWriteConnectedAccount,
  revokeSession,
  fetchCommandCenterYoloManifest,
  fetchCommandCenterCronJobsFromFirestore,
  fetchMeridianDashboardFromFirestore,
} from "./firebase-admin";

describe("firebase-admin (no service account in test)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("verifyIdToken returns null", async () => {
    expect(await verifyIdToken("token")).toBeNull();
  });

  it("createSessionCookie returns null", async () => {
    expect(await createSessionCookie("token")).toBeNull();
  });

  it("verifySessionCookie returns null", async () => {
    expect(await verifySessionCookie("cookie")).toBeNull();
  });

  it("adminWriteSubscription returns false", async () => {
    expect(await adminWriteSubscription("c", {})).toBe(false);
  });

  it("adminWriteConnectedAccount returns false", async () => {
    expect(await adminWriteConnectedAccount("u", {})).toBe(false);
  });

  it("revokeSession returns false", async () => {
    expect(await revokeSession("uid")).toBe(false);
  });

  it("fetchCommandCenterYoloManifest returns null", async () => {
    expect(await fetchCommandCenterYoloManifest()).toBeNull();
  });

  it("fetchCommandCenterCronJobsFromFirestore returns null", async () => {
    expect(await fetchCommandCenterCronJobsFromFirestore()).toBeNull();
  });

  it("fetchMeridianDashboardFromFirestore returns null", async () => {
    expect(await fetchMeridianDashboardFromFirestore()).toBeNull();
  });
});
