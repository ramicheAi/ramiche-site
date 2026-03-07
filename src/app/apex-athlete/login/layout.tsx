import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettleLogin");

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
