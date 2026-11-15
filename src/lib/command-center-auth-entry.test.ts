import { describe, expect, it } from "vitest";
import { AUTH_ENTRY_PATHS, isAuthEntryPath } from "./command-center-auth-entry";

describe("Command Center credential entry routes", () => {
  it("treats exactly the unlock and bootstrap pages as entry points", () => {
    expect(isAuthEntryPath("/command-center/unlock")).toBe(true);
    expect(isAuthEntryPath("/command-center/bootstrap")).toBe(true);
    expect(AUTH_ENTRY_PATHS).toEqual(["/command-center/unlock", "/command-center/bootstrap"]);
  });

  it("does not treat any normal Command Center page as an entry point", () => {
    for (const path of [
      "/command-center",
      "/command-center/",
      "/command-center/dashboard",
      "/command-center/devices",
      "/command-center/unlock/extra",
      "/command-login",
      "/",
    ]) {
      expect(isAuthEntryPath(path)).toBe(false);
    }
  });
});
