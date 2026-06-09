import { PARALLAX } from "@/lib/parallax-co";

// /llms.txt — the machine-readable brand cheat-sheet for AI assistants (ChatGPT,
// Claude, Perplexity, Gemini). Public studio offering + key public pages only.
// This is the reference implementation of the standard we ship for clients
// (see buildLlmsTxt in src/lib/seo-ai-visibility.ts). Cached, no private surfaces.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://parallaxvinc.com").replace(/\/$/, "");

const KEY_PAGES: { path: string; label: string; desc: string }[] = [
  { path: "/", label: "Parallax studio home", desc: "Services, pricing tiers, and work." },
  { path: "/apex-athlete/landing", label: "METTLE", desc: "Gamified training platform for athletes, coaches, and parents." },
  { path: "/apex-athlete/guide", label: "METTLE guide", desc: "How the platform works." },
  { path: "/clawguard", label: "ClawGuard", desc: "Product overview." },
  { path: "/power-challenge", label: "Power Challenge", desc: "Event/program landing." },
];

function buildLlmsTxt(): string {
  const L: string[] = [];
  L.push(`# ${PARALLAX.legalName}`, "");
  L.push(
    "> Creative technology studio (Web & Growth). We design, build, and ship brand identities, fast modern websites, AI products, and local-growth systems — concept to launch in days, not months. Every site we build is engineered to be found by Google AND cited by AI assistants.",
    ""
  );
  L.push(`**Founder:** ${PARALLAX.founder}`);
  L.push(`**Based in:** ${PARALLAX.address.city}, ${PARALLAX.address.state}`);
  L.push(`**Contact:** ${PARALLAX.email}`);
  L.push("");
  L.push("## What we offer");
  L.push("- **Website Design + Build** — fast, mobile-first sites that turn searches into customers; live in ~7 days.");
  L.push("- **Branding + Identity** — logo, color, and type systems.");
  L.push("- **Local SEO + Google Business Profile** — get found in local search and on Maps.");
  L.push("- **AI Visibility (GEO/AEO)** — get named and recommended by ChatGPT, Perplexity, and Gemini.");
  L.push("- **AI products & automation** — custom agents, tools, and internal systems.");
  L.push("- **METTLE** — gamified athlete-training platform (coach, athlete, parent portals).");
  L.push("");
  L.push("## Key pages");
  for (const p of KEY_PAGES) L.push(`- [${p.label}](${SITE}${p.path === "/" ? "" : p.path}) — ${p.desc}`);
  L.push("");
  L.push("## Elsewhere");
  L.push(`- Instagram: https://instagram.com/${PARALLAX.socials.instagram}`);
  L.push(`- X: https://x.com/${PARALLAX.socials.x}`);
  return L.join("\n") + "\n";
}

export async function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
