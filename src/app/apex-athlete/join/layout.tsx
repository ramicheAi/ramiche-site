import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleJoin");

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
