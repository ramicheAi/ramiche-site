import type { MetadataRoute } from "next";
import { AI_CRAWLERS } from "@/lib/seo-ai-visibility";

// robots.txt — generated, not static, so it stays in sync. Public marketing pages
// are crawlable by both search engines AND AI assistants; the private Command
// Center / app surfaces and internal tools are blocked for everyone (incl. AI
// crawlers). Canonical public origin is parallaxvinc.com (the apex serves the
// public site; command.* serves the gated OS via middleware).

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://parallaxvinc.com").replace(/\/$/, "");

// Private / internal — never index, never feed to AI.
const DISALLOW = [
  "/command-center", // the whole OS
  "/api/", // all API routes
  "/apex-athlete/coach",
  "/apex-athlete/athlete",
  "/apex-athlete/parent",
  "/apex-athlete/portal",
  "/apex-athlete/billing",
  "/apex-athlete/login",
  "/apex-athlete/join",
  "/apex-athlete/onboard",
  "/apex-athlete/meet-tracker",
  "/power-challenge/admin",
  "/pricing/modeler",
  "/forge",
  "/studio",
  "/agents",
  "/publish",
  "/financial",
  "/_music_bak",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everyone (default): crawl public pages, stay out of the private surface.
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      // AI assistants are explicitly welcomed on the public pages — same blocks apply.
      { userAgent: [...AI_CRAWLERS], allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
