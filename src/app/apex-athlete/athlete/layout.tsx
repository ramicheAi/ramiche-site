import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Athlete Dashboard",
  description: "Track your level, XP, streaks, best times, and active quests. Your training, gamified.",
  openGraph: {
    title: "METTLE — Athlete Dashboard",
    description: "Track your level, XP, streaks, best times, and active quests.",
  },
  twitter: {
    card: "summary",
    title: "METTLE — Athlete Dashboard",
    description: "Track your level, XP, streaks, and best times.",
  },
};

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
