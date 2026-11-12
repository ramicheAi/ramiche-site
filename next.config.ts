import type { NextConfig } from "next";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { withSentryConfig } from "@sentry/nextjs";

// Agent-generated builds must never live under public/: Next serves public/ statically with the
// global CSP (no sandbox) and header rules match the raw path, so encoded URLs bypass the sandbox
// rule. Fail the build/start on any host that has content there (CC-FINAL-MERGE-GATE-05).
{
  const d = path.join(process.cwd(), "public", "yolo-builds");
  if (existsSync(d) && readdirSync(d).length > 0) {
    throw new Error("public/yolo-builds must be empty: agent builds are served only via the owner-gated preview API");
  }
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.firebaseapp.com https://*.googleapis.com https://js.stripe.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleapis.com https://*.stripe.com https://*.supabase.co",
      "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com https://api.stripe.com https://vitals.vercel-insights.com https://va.vercel-scripts.com wss://*.firebaseio.com https://wttr.in https://bible-api.com https://*.supabase.co wss://*.supabase.co https://*.ingest.us.sentry.io",
      "frame-src 'self' https://js.stripe.com https://*.firebaseapp.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  logging: {
    browserToTerminal: true,
  },
  // The /api/command-center/projects route reads public/projects/<slug>/<file> with a
  // DYNAMIC path, so Next's file tracer bundles the ENTIRE 249MB public/projects dir
  // (yummyz vectors/PDFs, logs) into that lambda → over Vercel's 250MB function limit →
  // "Deploying outputs" fails (build succeeds, deploy errors). The route is GitHub-first
  // and only ever reads small .md/.json locally, so exclude the heavy non-text assets
  // from every function's trace. This is what unfroze command-center deploys.
  outputFileTracingExcludes: {
    "*": [
      "public/projects/**/*.svg",
      "public/projects/**/*.pdf",
      "public/projects/**/*.png",
      "public/projects/**/*.jpg",
      "public/projects/**/*.jpeg",
      "public/projects/**/*.gif",
      "public/projects/**/*.webp",
      "public/projects/**/*.mp4",
      "public/projects/**/*.zip",
      "public/projects/**/logs/**",
      "public/yolo-builds/**",
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
    prefetchInlining: true,
  },
  redirects: async () => [
    {
      source: "/portal",
      destination: "/apex-athlete/portal",
      permanent: false,
    },
    {
      source: "/apex-athlete",
      destination: "/apex-athlete/coach",
      permanent: true,
    },
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
    {
      source: "/apex-athlete/:path*",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
      ],
    },
    {
      source: "/apex-athlete",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "https://ramiche-site.vercel.app" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        { key: "Access-Control-Max-Age", value: "86400" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
    {
      // Agent-generated builds under public/ are untrusted active content. Serve them in an
      // opaque-origin sandbox so they can never act as the owner (same-origin fetch + cookie).
      source: "/yolo-builds/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    },
    {
      // The owner-only preview API route serves the same untrusted builds. Next keeps the FIRST
      // value set for a header key, and the global rule already set a CSP, so a CSP set in the route
      // handler is dropped; the rule must live here (last wins) to reach the wire. Opaque-origin
      // opaque-origin sandbox so they can never act as the owner (same-origin fetch + cookie).
      source: "/api/command-center/yolo-builds/preview/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; media-src 'self' data: blob: https:; connect-src 'none'; form-action 'none'; base-uri 'none'" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: false },
  disableLogger: true,
  automaticVercelMonitors: false,
});
