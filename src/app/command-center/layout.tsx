import type { Metadata, Viewport } from "next";
import CommandCenterClientLayout from "./CommandCenterClientLayout";

/**
 * Command Center is its own installable application, not a shortcut to the
 * marketing site. The root layout's manifest (start_url "/", name "Parallax")
 * is inherited by every route, which made an iOS Home Screen install launch
 * the marketing homepage. This segment overrides the manifest, the Apple web
 * app metadata, the icons and the canonical URL for /command-center only.
 */
export const metadata: Metadata = {
  title: "RAMICHE Command Center",
  applicationName: "RAMICHE Command Center",
  description: "RAMICHE Command Center operations console.",
  manifest: "/manifest-command-center.webmanifest",
  alternates: {
    canonical: "/command-center",
  },
  icons: {
    icon: [
      { url: "/pwa/command-center/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/command-center/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/pwa/command-center/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Command Center",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0e0e18",
};

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CommandCenterClientLayout>{children}</CommandCenterClientLayout>;
}
