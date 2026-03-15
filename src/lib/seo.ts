/**
 * SEO Metadata Generator
 * Auto-generates Open Graph and Twitter cards for all public pages
 */

import { Metadata } from "next";

export interface SEOConfig {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article" | "profile";
  noIndex?: boolean;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ramiche.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

/**
 * Generate comprehensive SEO metadata for a page
 */
export function generateSEO(config: SEOConfig): Metadata {
  const {
    title,
    description,
    path,
    image = DEFAULT_OG_IMAGE,
    type = "website",
    noIndex = false,
  } = config;

  const fullTitle = title.includes("Parallax") ? title : `${title} | Parallax Operations`;
  const url = `${SITE_URL}${path}`;

  return {
    title: fullTitle,
    description,
    ...(noIndex && { robots: { index: false, follow: false } }),

    // Open Graph
    openGraph: {
      type,
      url,
      title: fullTitle,
      description,
      siteName: "Parallax Operations",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "en_US",
    },

    // Twitter Card
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
      creator: "@ramichemusic",
      site: "@ramichemusic",
    },

    // Additional metadata
    alternates: {
      canonical: url,
    },
  };
}

/**
 * Predefined SEO configs for common pages
 */
export const SEO_CONFIGS = {
  home: {
    title: "Parallax Operations",
    description: "Automation dock — all projects, all signals, one view",
    path: "/",
  },

  // METTLE (Apex Athlete)
  mettle: {
    title: "METTLE — Where Athletes Find Their Edge",
    description: "Gamified training that transforms practice. Coach, athlete, and parent portals — all connected.",
    path: "/apex-athlete",
    image: `${SITE_URL}/og-mettle.png`,
  },
  mettleLanding: {
    title: "METTLE — Unlock Your Potential",
    description: "Level up your training. Track progress. Dominate your sport. The gamified athlete platform built for champions.",
    path: "/apex-athlete/landing",
    image: `${SITE_URL}/og-mettle.png`,
  },
  mettleCoach: {
    title: "Coach Portal — METTLE",
    description: "Manage your team, create workouts, track athlete progress",
    path: "/apex-athlete/coach",
    noIndex: true,
  },
  mettleAthlete: {
    title: "Athlete Portal — METTLE",
    description: "Complete quests, track progress, level up",
    path: "/apex-athlete/athlete",
    noIndex: true,
  },
  mettleParent: {
    title: "Parent Portal — METTLE",
    description: "Monitor your athlete's progress and engagement",
    path: "/apex-athlete/parent",
    noIndex: true,
  },
  mettleJoin: {
    title: "Join Team — METTLE",
    description: "Join your team and start your journey",
    path: "/apex-athlete/join",
    noIndex: true,
  },
  mettleLogin: {
    title: "Login — METTLE",
    description: "Access your METTLE account",
    path: "/apex-athlete/login",
    noIndex: true,
  },
  mettleGuide: {
    title: "Guide — METTLE",
    description: "Learn how to use METTLE",
    path: "/apex-athlete/guide",
  },
  mettleBilling: {
    title: "Billing — METTLE",
    description: "Manage your subscription",
    path: "/apex-athlete/billing",
    noIndex: true,
  },

  // Command Center
  commandCenter: {
    title: "Command Center",
    description: "Mission control for all Parallax operations",
    path: "/command-center",
    noIndex: true,
  },
  agents: {
    title: "Agents - Command Center",
    description: "OpenClaw agent management and monitoring",
    path: "/command-center/agents",
    noIndex: true,
  },
  tasks: {
    title: "Tasks - Command Center",
    description: "Cron jobs and scheduled tasks",
    path: "/command-center/tasks",
    noIndex: true,
  },
  vitals: {
    title: "Vitals - Command Center",
    description: "System health and performance metrics",
    path: "/command-center/vitals",
    noIndex: true,
  },
  revenue: {
    title: "Revenue - Command Center",
    description: "Revenue tracking and analytics",
    path: "/command-center/revenue",
    noIndex: true,
  },

  // Other projects
  forge: {
    title: "Forge",
    description: "Product and project development workspace",
    path: "/forge",
    noIndex: true,
  },
  studio: {
    title: "Ramiche Studio",
    description: "Music production and creative studio",
    path: "/studio",
    noIndex: true,
  },
} as const;

/**
 * Get SEO metadata for a predefined page
 */
export function getPageSEO(page: keyof typeof SEO_CONFIGS): Metadata {
  return generateSEO(SEO_CONFIGS[page]);
}

/**
 * Generate METTLE-specific metadata (preserves branding, icons, theme)
 */
export function generateMettleSEO(page: keyof typeof SEO_CONFIGS): Metadata {
  const seo = generateSEO(SEO_CONFIGS[page]);

  return {
    ...seo,
    manifest: "/mettle-manifest.json",
    icons: {
      icon: "/mettle-brand/v5/mettle-icon.svg",
      apple: "/mettle-brand/v5/apple-touch-icon-dark.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "METTLE",
    },
    other: {
      "theme-color": "#030108",
    },
    openGraph: {
      ...seo.openGraph,
      siteName: "METTLE",
    },
  };
}
