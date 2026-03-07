import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleAthlete");

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
