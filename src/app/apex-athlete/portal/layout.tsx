import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Select Your Portal",
  description:
    "Choose your portal: Coach, Athlete, or Parent. Access your personalised METTLE dashboard.",
  openGraph: {
    title: "METTLE — Select Your Portal",
    description: "Choose your portal: Coach, Athlete, or Parent. Access your personalised METTLE dashboard.",
  },
  twitter: {
    card: "summary",
    title: "METTLE — Select Your Portal",
    description: "Choose your portal: Coach, Athlete, or Parent.",
  },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
