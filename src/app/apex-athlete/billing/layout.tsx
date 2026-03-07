import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleBilling");

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
