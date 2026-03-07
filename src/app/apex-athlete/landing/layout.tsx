import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Gamified Athlete Development",
  description:
    "Transform your training programme with gamified athlete development. Coach, athlete, and parent portals — all connected through the power of play.",
  openGraph: {
    title: "METTLE — Gamified Athlete Development",
    description:
      "Transform your training programme with gamified athlete development. Coach, athlete, and parent portals — all connected.",
  },
  twitter: {
    card: "summary_large_image",
    title: "METTLE — Gamified Athlete Development",
    description:
      "Transform your training programme with gamified athlete development. Coach, athlete, and parent portals — all connected.",
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
