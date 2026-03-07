import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How to Use METTLE — User Guide",
  description:
    "Complete guide to METTLE: setup, coach portal, athlete progression, parent visibility, level system, meet management, and quests.",
  openGraph: {
    title: "How to Use METTLE — User Guide",
    description:
      "Complete guide to METTLE: setup, coach portal, athlete progression, parent visibility, and more.",
  },
  twitter: {
    card: "summary",
    title: "How to Use METTLE — User Guide",
    description: "Complete guide to METTLE: setup, portals, levels, meets, and quests.",
  },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
