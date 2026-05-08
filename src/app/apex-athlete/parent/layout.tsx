import type { Metadata } from "next";
import { generateMettleSEO } from "@/lib/seo";
import { gamificationEnabled } from "../flags";
import { GamificationFlagProvider } from "../gamification-flag-context";

export const metadata: Metadata = generateMettleSEO("mettleParent");

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const gamification = await gamificationEnabled();
  return (
    <GamificationFlagProvider enabled={gamification}>
      {children}
    </GamificationFlagProvider>
  );
}
