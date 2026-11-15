import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, "public/manifest-command-center.webmanifest"), "utf8")
) as {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
};
const layout = readFileSync(join(root, "src/app/command-center/layout.tsx"), "utf8");
const clientLayout = readFileSync(
  join(root, "src/app/command-center/CommandCenterClientLayout.tsx"),
  "utf8"
);

describe("Command Center PWA identity", () => {
  it("launches /command-center as a standalone app, not the marketing root", () => {
    expect(manifest.name).toBe("RAMICHE Command Center");
    expect(manifest.short_name).toBe("Command Center");
    expect(manifest.start_url).toBe("/command-center");
    expect(manifest.scope).toBe("/command-center");
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
    expect(manifest.id).toBe("/command-center");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#0e0e18");
    expect(manifest.theme_color).toBe("#0e0e18");
  });

  it("ships installable and maskable icons as real PNG files", () => {
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"])
    );
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const path = join(root, "public", icon.src.replace(/^\//, ""));
      expect(existsSync(path), path).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(500);
      expect(icon.type).toBe("image/png");
    }
  });

  it("contains no bootstrap secret, token or approval code", () => {
    const text = JSON.stringify(manifest).toLowerCase();
    expect(text).not.toMatch(/bootstrap|secret|token|approval|code/);
  });

  it("links the dedicated manifest and Apple metadata from the Command Center layout", () => {
    expect(layout).toContain('manifest: "/manifest-command-center.webmanifest"');
    expect(layout).toContain("appleWebApp");
    expect(layout).toContain('title: "Command Center"');
    expect(layout).toContain('canonical: "/command-center"');
    expect(layout).toContain("/pwa/command-center/icon-180.png");
    expect(layout).toContain("/pwa/command-center/icon-192.png");
  });

  it("keeps the credential entry pages outside the cockpit shell", () => {
    expect(clientLayout).toContain("isAuthEntryPath");
    expect(clientLayout).toContain("return <>{children}</>");
  });
});
