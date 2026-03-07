import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleLanding");

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
