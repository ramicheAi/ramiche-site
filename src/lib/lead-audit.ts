// /Users/admin/ramiche-site/src/lib/lead-audit.ts
// Lightweight, free digital-presence audit for a lead. Checks what we can verify
// without paid APIs (website reachability, SSL, mobile-friendliness, speed) and
// flags the high-probability opportunity gaps (GBP, reviews, social) that a
// typical small local business is missing. Produces gaps + a health score.
import type { GapId } from "@/lib/services-catalog";

export interface AuditSignals {
  hasWebsite: boolean;
  reachable: boolean | null;
  https: boolean | null;
  mobileFriendly: boolean | null;
  responseMs: number | null;
  title: string | null;
}

export interface AuditResult {
  signals: AuditSignals;
  gaps: GapId[];
  healthScore: number; // 0..100
}

const UA = "ParallaxCommandCenter/1.0 (+lead-audit)";

export async function auditLead(input: { website?: string | null }): Promise<AuditResult> {
  const website = (input.website || "").trim();
  const gaps = new Set<GapId>();
  const signals: AuditSignals = { hasWebsite: !!website, reachable: null, https: null, mobileFriendly: null, responseMs: null, title: null };

  if (!website) {
    gaps.add("no_website");
    gaps.add("not_mobile");
    gaps.add("no_ssl");
    gaps.add("no_email_capture");
    gaps.add("no_ai_visibility"); // no site → nothing for an AI assistant to cite
  } else {
    signals.https = website.startsWith("https://");
    if (!signals.https) gaps.add("no_ssl");
    try {
      const url = website.startsWith("http") ? website : `https://${website}`;
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" });
      clearTimeout(timer);
      signals.responseMs = Date.now() - t0;
      signals.reachable = res.ok;
      // True https = what we actually ended up on after redirects, not the stored string.
      signals.https = res.url ? res.url.startsWith("https://") : signals.https;
      if (signals.https) gaps.delete("no_ssl"); else gaps.add("no_ssl");
      if (signals.responseMs > 3500) gaps.add("slow_site");
      if (!res.ok) {
        // 403/challenge/error pages aren't the client's site — don't fabricate
        // content gaps from a bot-block interstitial. Flag reachability only.
        gaps.add("outdated_website");
      } else {
        // Full body (bounded) for the structured-data check — JSON-LD often sits
        // late in <head> or in <body>, past any small prefix.
        const fullHtml = (await res.text()).slice(0, 500_000).toLowerCase();
        const html = fullHtml.slice(0, 60_000);
        signals.mobileFriendly = html.includes('name="viewport"') || html.includes("name='viewport'");
        if (!signals.mobileFriendly) gaps.add("not_mobile");
        const m = html.match(/<title[^>]*>([^<]*)<\/title>/);
        signals.title = m ? m[1].trim().slice(0, 120) : null;
        if (!html.includes("mailto:") && !html.includes("subscribe") && !html.includes("newsletter")) gaps.add("no_email_capture");
        // AI visibility: no structured data (JSON-LD or microdata) → assistants
        // can't reliably read/cite the business.
        if (!fullHtml.includes("application/ld+json") && !fullHtml.includes('itemtype="http')) gaps.add("no_ai_visibility");
      }
    } catch {
      signals.reachable = false;
      gaps.add("outdated_website");
    }
  }

  // High-probability opportunity gaps we can't verify for free (no Places API).
  // Recommended by default for local SMBs; the recommendation labels them as opportunities.
  gaps.add("no_gbp");
  gaps.add("few_reviews");
  gaps.add("no_social");
  if (!website) gaps.add("no_online_ordering");

  // Health score from verifiable website signals (social/GBP unverified → not scored up).
  let score = 0;
  if (signals.hasWebsite) score += 30;
  if (signals.reachable) score += 18;
  if (signals.https) score += 16;
  if (signals.mobileFriendly) score += 22;
  if (signals.responseMs != null && signals.responseMs <= 3500) score += 14;
  const healthScore = Math.min(100, score);

  return { signals, gaps: Array.from(gaps), healthScore };
}
