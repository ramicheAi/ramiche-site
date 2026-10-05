/**
 * P06 M5C: Parallax OS pages never carry the public marketing site's title, OpenGraph or manifest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { cockpitMetadata } from "./cockpit-metadata";

const MARKETING = /Creative Technology Studio|Built and Shipped|AI-Powered Creative Studio/;

it("cockpit metadata has its own title and manifest, no marketing title or social cards, and is never indexed", () => {
  for (const title of ["Parallax OS", "Parallax OS · Sign in"]) {
    const m = cockpitMetadata(title);
    expect(m.title).toBe(title);
    expect(m.manifest).toBe("/parallax-os.webmanifest");
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.openGraph).toBeNull();
    expect(m.twitter).toBeNull();
    expect(JSON.stringify(m)).not.toMatch(MARKETING);
  }
});

it("both cockpit entry layouts export the cockpit metadata", () => {
  for (const [file, title] of [["src/app/command-center/layout.tsx", "'Parallax OS'"], ["src/app/command-login/layout.tsx", '"Parallax OS · Sign in"']]) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    expect(src).toContain(`export const metadata = cockpitMetadata(${title});`);
  }
});

it("the Parallax OS manifest opens the cockpit, never the public root", () => {
  const m = JSON.parse(readFileSync(join(process.cwd(), "public/parallax-os.webmanifest"), "utf8"));
  expect(m.start_url).toBe("/command-center");
  expect(m.name).toBe("Parallax OS");
  expect(JSON.stringify(m)).not.toMatch(MARKETING);
});
