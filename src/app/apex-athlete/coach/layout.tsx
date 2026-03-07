import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Coach Dashboard",
  description: "Manage your roster, assign quests, track athlete progression, and run meets.",
  openGraph: {
    title: "METTLE — Coach Dashboard",
    description: "Manage your roster, assign quests, track athlete progression, and run meets.",
  },
  twitter: {
    card: "summary",
    title: "METTLE — Coach Dashboard",
    description: "Manage your roster, assign quests, and track athlete progression.",
  },
};

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return children;
}
