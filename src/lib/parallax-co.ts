// /Users/admin/ramiche-site/src/lib/parallax-co.ts
// Single source of truth for Parallax Ventures Inc. business details used on
// proposals + invoices. Fill the TODOs with your real registered info.
export const PARALLAX = {
  legalName: "Parallax Ventures Inc.",
  brand: "Parallax",
  division: "Web & Growth Studio",
  tagline: "Creative Technology Studio",
  website: "parallaxvinc.com",
  email: "parallaxventuresinc@gmail.com",
  logo: "/parallax-icon-512.png", // the navy P mark — used on docs
  logoUrl: "https://command.parallaxvinc.com/parallax-icon-512.png", // absolute, for email
  phone: "", // TODO: business phone (shown on invoices)
  address: { line1: "", city: "Fort Lauderdale", state: "FL", zip: "", country: "USA" }, // TODO: registered address
  founder: "Ramon Walton",
  socials: { x: "PARALLAXVINC", instagram: "PARALLAXVINC" },
  payment: {
    terms: "50% deposit to begin · 50% on launch. Monthly services billed in advance.",
    methods: "Card / ACH via secure Stripe invoice",
    link: "", // TODO: Stripe payment link (so invoices are pay-now)
  },
  accent: "#22c55e",
} as const;

export function parallaxAddressLine(): string {
  const a = PARALLAX.address;
  return [a.line1, [a.city, a.state].filter(Boolean).join(", "), a.zip].filter(Boolean).join(" · ") || `${a.city}, ${a.state}`;
}
