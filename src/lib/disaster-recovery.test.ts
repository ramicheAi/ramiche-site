import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createBackup, restoreBackup, getLastBackupInfo } from "./disaster-recovery";

function makeLS() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(i: number) {
      return [...data.keys()][i] ?? null;
    },
    getItem(k: string) {
      return data.has(k) ? data.get(k)! : null;
    },
    setItem(k: string, v: string) {
      data.set(k, v);
    },
    removeItem(k: string) {
      data.delete(k);
    },
    clear() {
      data.clear();
    },
  } as Storage;
}

describe("disaster-recovery", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", makeLS());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("createBackup builds manifest", async () => {
    localStorage.setItem("mettle-feature-flags", "{}");
    const { manifest, data } = await createBackup();
    expect(manifest.version).toBe(2);
    expect(JSON.parse(data)["mettle-feature-flags"]).toBe("{}");
    expect(getLastBackupInfo()?.checksum).toBe(manifest.checksum);
  });

  it("restoreBackup restores keys", async () => {
    localStorage.setItem("apex-times", "{}");
    const { manifest, data } = await createBackup();
    localStorage.removeItem("apex-times");
    const r = await restoreBackup(data, manifest);
    expect(r.errors).toEqual([]);
    expect(localStorage.getItem("apex-times")).toBe("{}");
  });

  it("restoreBackup rejects checksum mismatch", async () => {
    localStorage.setItem("mettle-feature-flags", "{}");
    const { manifest, data } = await createBackup();
    const obj = JSON.parse(data) as Record<string, string>;
    obj["mettle-feature-flags"] = "{ }";
    const tampered = JSON.stringify(obj);
    const r = await restoreBackup(tampered, manifest);
    expect(r.restored).toBe(0);
    expect(r.errors.some((e) => e.includes("Checksum"))).toBe(true);
  });

  it("restoreBackup rejects invalid JSON when checksum matches", async () => {
    const raw = "not-json";
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
    const checksum = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
    const manifest = {
      version: 2 as const,
      timestamp: 1,
      keys: [],
      sizeBytes: raw.length,
      checksum,
    };
    const r = await restoreBackup(raw, manifest);
    expect(r.restored).toBe(0);
    expect(r.errors.some((e) => e.includes("parse"))).toBe(true);
  });

  it("getLastBackupInfo returns null on corrupt meta", () => {
    localStorage.setItem("mettle-backup-meta", "not-json");
    expect(getLastBackupInfo()).toBeNull();
  });
});
