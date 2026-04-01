/** IP / compliance snapshot — edit here; legal page reads via API. */

export const IP_PORTFOLIO = [
  { type: "Copyright", item: "METTLE Software", status: "Filed", date: "Feb 17, 2026", color: "#22c55e" },
  { type: "Patent", item: "METTLE ARM System", status: "Filing (USPTO)", date: "In progress", color: "#f59e0b" },
  { type: "Trademark", item: "METTLE (Class 9+41+42)", status: "Recommended", date: "Pending", color: "#818cf8" },
  { type: "Copyright", item: "OpenClaw Framework", status: "Protectable", date: "Not filed", color: "#6b7280" },
] as const;

export const COMPLIANCE_AREAS = [
  { area: "Data Privacy (CCPA/GDPR)", status: "Needs Review", risk: "medium" as const },
  { area: "AI Agent Liability", status: "Framework Needed", risk: "high" as const },
  { area: "Terms of Service", status: "Draft", risk: "medium" as const },
  { area: "Client Contracts", status: "Template Ready", risk: "low" as const },
  { area: "Stripe/Payment Compliance", status: "Active", risk: "low" as const },
  { area: "Apple App Store Guidelines", status: "Needs Review", risk: "medium" as const },
] as const;
