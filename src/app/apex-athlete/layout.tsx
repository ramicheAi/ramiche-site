import type { Metadata } from "next";
import ErrorReporterInit from "@/components/ErrorReporterInit";
import PageTransition from "@/components/PageTransition";
import { generateMettleSEO } from "@/lib/seo";

export const metadata: Metadata = generateMettleSEO("mettle");

export default function MettleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div data-mettle="">
      <ErrorReporterInit />
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
