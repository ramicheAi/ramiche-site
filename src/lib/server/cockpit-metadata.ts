import type { Metadata } from "next";

/**
 * P06 M5C: Parallax OS pages carry their own identity, never the public marketing site's (the root layout's
 * "Parallax — Creative Technology Studio" title, OpenGraph and manifest). The cockpit manifest starts at
 * /command-center, so an installed app opens Parallax OS, and the pages are never indexed.
 */
export function cockpitMetadata(title: string): Metadata {
  return {
    title,
    description: "Parallax OS command center (owner only).",
    manifest: "/parallax-os.webmanifest",
    robots: { index: false, follow: false },
    openGraph: null,
    twitter: null,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Parallax OS" },
  };
}
