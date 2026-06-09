import type { MetadataRoute } from "next";

// sitemap.xml — only the PUBLIC, indexable marketing pages (mirrors the non-noIndex
// configs in src/lib/seo.ts). Private app surfaces are intentionally excluded and
// are also blocked in robots.ts. Canonical public origin = parallaxvinc.com.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://parallaxvinc.com").replace(/\/$/, "");

type Entry = { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number };

const PUBLIC_PAGES: Entry[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 }, // Parallax studio home
  { path: "/apex-athlete", changeFrequency: "weekly", priority: 0.9 }, // METTLE
  { path: "/apex-athlete/landing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/apex-athlete/guide", changeFrequency: "monthly", priority: 0.6 },
  { path: "/mettle", changeFrequency: "weekly", priority: 0.8 },
  { path: "/clawguard", changeFrequency: "monthly", priority: 0.7 },
  { path: "/power-challenge", changeFrequency: "monthly", priority: 0.6 },
  { path: "/power-challenge/register", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PAGES.map((p) => ({
    url: `${SITE}${p.path === "/" ? "" : p.path}`,
    lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
