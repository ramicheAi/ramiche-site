import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleGuide");

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
