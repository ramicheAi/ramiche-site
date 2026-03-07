import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Billing & Subscription",
  description: "Manage your METTLE subscription, billing details, and plan.",
  openGraph: {
    title: "METTLE — Billing & Subscription",
    description: "Manage your METTLE subscription, billing details, and plan.",
  },
  twitter: {
    card: "summary",
    title: "METTLE — Billing & Subscription",
    description: "Manage your METTLE subscription and plan.",
  },
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
