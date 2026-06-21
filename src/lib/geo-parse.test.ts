import { describe, it, expect } from "vitest";
import { cityStateFromAddress } from "./geo-parse";

describe("cityStateFromAddress", () => {
  it("parses 'City, ST, ZIP'", () => {
    expect(cityStateFromAddress("11842 Bruce B Downs Boulevard, Tampa, FL, 33612")).toBe("Tampa, FL");
  });
  it("parses 'City, ST ZIP' and multi-word cities", () => {
    expect(cityStateFromAddress("123 Main St, Fort Lauderdale, FL 33301")).toBe("Fort Lauderdale, FL");
  });
  it("parses without a trailing zip", () => {
    expect(cityStateFromAddress("456 Oak Ave, Miami, FL")).toBe("Miami, FL");
  });
  it("returns null when unparseable", () => {
    expect(cityStateFromAddress("")).toBeNull();
    expect(cityStateFromAddress(null)).toBeNull();
    expect(cityStateFromAddress("just some text")).toBeNull();
  });
});
