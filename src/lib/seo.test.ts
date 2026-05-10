import { describe, it, expect } from "vitest";
import { generateSEO, getPageSEO, generateMettleSEO } from "./seo";

describe("seo", () => {
  it("suffixes title", () => {
    const m = generateSEO({ title: "T", description: "d", path: "/p" });
    expect(m.title).toContain("Parallax Operations");
  });

  it("does not double-suffix when title already includes Parallax", () => {
    const m = generateSEO({
      title: "Parallax Operations — Home",
      description: "d",
      path: "/",
    });
    expect(m.title).toBe("Parallax Operations — Home");
  });

  it("sets robots noindex when noIndex is true", () => {
    const m = generateSEO({
      title: "Private",
      description: "d",
      path: "/private",
      noIndex: true,
    });
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it("uses article openGraph type when requested", () => {
    const m = generateSEO({
      title: "Post",
      description: "d",
      path: "/blog/p",
      type: "article",
    });
    // Next.js OpenGraph types narrow `type` based on the variant. Cast for the
    // assertion since we know the requested variant is `article`.
    expect((m.openGraph as { type?: string } | undefined)?.type).toBe("article");
  });

  it("getPageSEO home", () => {
    const m = getPageSEO("home");
    expect(m.title).toBeDefined();
  });

  it("getPageSEO mettleCoach includes noIndex", () => {
    const m = getPageSEO("mettleCoach");
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it("generateMettleSEO sets METTLE siteName", () => {
    const m = generateMettleSEO("mettle");
    expect(m.openGraph?.siteName).toBe("METTLE");
  });

  it("generateMettleSEO includes manifest and icons", () => {
    const m = generateMettleSEO("mettle");
    expect(m.manifest).toBe("/mettle-manifest.json");
    // `Metadata.icons` is a union type; narrow to the object shape we set.
    const icons = m.icons as { icon?: string } | undefined;
    expect(icons?.icon).toBe("/mettle-brand/v5/mettle-icon.svg");
  });
});
