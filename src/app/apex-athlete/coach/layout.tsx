import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleCoach");

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return children;
}
