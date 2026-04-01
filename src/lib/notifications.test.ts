import { describe, it, expect } from "vitest";
import { getNotificationStatus, getStoredToken } from "./notifications";

describe("notifications (Node)", () => {
  it("unsupported without window", () => {
    expect(getNotificationStatus()).toBe("unsupported");
    expect(getStoredToken()).toBeNull();
  });
});
