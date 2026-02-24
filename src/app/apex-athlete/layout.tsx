import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Athlete Relations Manager",
  description: "Unlocking the greatness already inside every athlete — through the power of play.",
  icons: {
    icon: "/mettle-brand/v5/mettle-icon.svg",
    apple: "/mettle-brand/v5/mettle-icon.svg",
  },
};

export default function MettleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
