import type { Metadata } from "next";
import ErrorReporterInit from "@/components/ErrorReporterInit";
import PageTransition from "@/components/PageTransition";
import MettleMicroInteractions from "@/components/MettleMicroInteractions";
import SWUpdateHandler from "@/components/SWUpdateHandler";

export const metadata: Metadata = {
  title: "METTLE — Athlete Relations Manager",
  description: "Unlocking the greatness already inside every athlete — through the power of play.",
  manifest: "/mettle-manifest.json",
  icons: {
    icon: "/mettle-brand/v5/mettle-icon.svg",
    apple: "/mettle-brand/v5/apple-touch-icon-dark.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "METTLE",
  },
  other: {
    "theme-color": "#030108",
  },
  openGraph: {
    title: "METTLE — Where Athletes Find Their Edge",
    description: "Gamified training that transforms practice. Coach, athlete, and parent portals — all connected.",
    siteName: "METTLE",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "METTLE — Where Athletes Find Their Edge",
    description: "Gamified training that transforms practice. Coach, athlete, and parent portals — all connected.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MettleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mettle-app">
      <ErrorReporterInit />
      <SWUpdateHandler />
      <MettleMicroInteractions />
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
