import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleParent");

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
