import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join METTLE — Athlete Development Platform",
  description:
    "Sign up your team for METTLE. Gamified training that transforms practice into progress.",
  openGraph: {
    title: "Join METTLE — Athlete Development Platform",
    description: "Sign up your team for METTLE. Gamified training that transforms practice into progress.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Join METTLE — Athlete Development Platform",
    description: "Sign up your team for METTLE. Gamified training that transforms practice into progress.",
  },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
