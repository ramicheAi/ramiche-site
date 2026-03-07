import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Parent Portal",
  description: "Stay connected to your child's training. View progress, milestones, and communicate with coaches.",
  openGraph: {
    title: "METTLE — Parent Portal",
    description: "Stay connected to your child's training. View progress, milestones, and communicate with coaches.",
  },
  twitter: {
    card: "summary",
    title: "METTLE — Parent Portal",
    description: "Stay connected to your child's training progress.",
  },
};

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
