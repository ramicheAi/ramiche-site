import type { Metadata } from "next";
import ErrorReporterInit from "@/components/ErrorReporterInit";

export const metadata: Metadata = {
  title: "METTLE — Athlete Relations Manager",
  description: "Unlocking the greatness already inside every athlete — through the power of play.",
  icons: {
    icon: "/mettle-brand/v5/mettle-icon.svg",
    apple: "/mettle-brand/v5/mettle-icon.svg",
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
    <>
      <ErrorReporterInit />
      {children}
    </>
  );
}
