"use client";

import { InstrumentPage } from "@/components/command-center/po/Instrument";

export default function AgentPricingModelerPage() {
  return (
    <InstrumentPage
      id="arbitrage"
      title="Agent Pricing"
      section="Business"
      icon="arbitrage"
      accent="var(--c-amber)"
    >
      <iframe
        src="/api/command-center/yolo-builds/preview/2026-03-19-verified-agent-pricing-modeler/index.html"
        style={{
          width: "100%",
          height: "calc(100vh - 220px)",
          minHeight: 600,
          border: "none",
          display: "block",
          borderRadius: "var(--r-md)",
        }}
        title="Verified Agent Pricing Modeler"
      />
    </InstrumentPage>
  );
}
