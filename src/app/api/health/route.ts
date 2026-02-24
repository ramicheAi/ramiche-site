import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  return NextResponse.json(
    {
      status: "healthy",
      service: "mettle",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      environment: process.env.VERCEL_ENV || "development",
      region: process.env.VERCEL_REGION || "unknown",
      uptime: process.uptime?.() || null,
      timestamp: new Date().toISOString(),
      latency_ms: Date.now() - start,
      firebase_configured: !!(
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      ),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
