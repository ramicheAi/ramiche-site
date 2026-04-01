/** Security posture — edit when WIDOW scans or mitigations change. */

export interface ThreatEntry {
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  mitigated: boolean;
}

export const KNOWN_THREATS: ThreatEntry[] = [
  { severity: "high", title: "Firebase Security Rules", detail: "Firestore rules locked down for production project", mitigated: true },
  { severity: "high", title: "CSP Headers", detail: "Content Security Policy configured with nonce + strict domains", mitigated: true },
  { severity: "medium", title: "API Rate Limiting", detail: "In-memory rate limits on sensitive CC API routes", mitigated: true },
  { severity: "medium", title: "Service Worker Cache", detail: "SW banned — self-destruct pattern deployed", mitigated: true },
  { severity: "low", title: "CORS Configuration", detail: "Restricted origins for bridge / APIs", mitigated: true },
  { severity: "critical", title: "Exposed API Keys", detail: "Secrets in env only; anon keys scoped per Supabase policy", mitigated: true },
  { severity: "high", title: "Role-Based Portal Isolation", detail: "Coach / athlete / parent portals isolated", mitigated: true },
  { severity: "medium", title: "Session Duration", detail: "Session cookies configured per product", mitigated: true },
];
