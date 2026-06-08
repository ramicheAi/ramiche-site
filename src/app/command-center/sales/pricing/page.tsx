"use client";

import { InstrumentPage } from "@/components/command-center/po/Instrument";

export default function PricingCalculatorPage() {
  return (
    <InstrumentPage
      id="finance"
      title="Pricing Calculator"
      section="Business"
      icon="finance"
      accent="var(--c-amber)"
    >
      <iframe
        src="/api/command-center/yolo-builds/preview/2026-03-17-mercury-pricing-calculator/index.html"
        style={{
          width: "100%",
          height: "calc(100vh - 220px)",
          minHeight: 600,
          border: "none",
          display: "block",
          borderRadius: "var(--r-md)",
        }}
        title="Pricing Calculator"
      />
    </InstrumentPage>
  );
}
