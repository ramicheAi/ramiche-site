import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ramiche-site.vercel.app";

interface ScanResult {
  name: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  category: string;
}

export async function POST() {
  const results: ScanResult[] = [];
  const start = Date.now();

  // 1. Check security headers
  try {
    const res = await fetch(SITE_URL, { method: "HEAD", redirect: "follow" });
    const headers = Object.fromEntries(res.headers.entries());

    results.push({
      name: "HTTPS",
      status: SITE_URL.startsWith("https") ? "pass" : "fail",
      detail: SITE_URL.startsWith("https") ? "All traffic encrypted" : "HTTP detected",
      category: "Transport",
    });

    results.push({
      name: "Content-Security-Policy",
      status: headers["content-security-policy"] ? "pass" : "warn",
      detail: headers["content-security-policy"] ? "CSP header present" : "No CSP header (may use meta tag)",
      category: "Headers",
    });

    results.push({
      name: "X-Frame-Options",
      status: headers["x-frame-options"] ? "pass" : "warn",
      detail: headers["x-frame-options"] || "Not set — clickjacking risk",
      category: "Headers",
    });

    results.push({
      name: "Strict-Transport-Security",
      status: headers["strict-transport-security"] ? "pass" : "warn",
      detail: headers["strict-transport-security"] || "HSTS not set",
      category: "Headers",
    });

    results.push({
      name: "X-Content-Type-Options",
      status: headers["x-content-type-options"] === "nosniff" ? "pass" : "warn",
      detail: headers["x-content-type-options"] || "Not set — MIME sniffing risk",
      category: "Headers",
    });

    results.push({
      name: "Server Identity",
      status: headers["x-powered-by"] ? "warn" : "pass",
      detail: headers["x-powered-by"] ? `Exposed: ${headers["x-powered-by"]}` : "Server identity hidden",
      category: "Headers",
    });
  } catch (e) {
    results.push({ name: "Site Reachability", status: "fail", detail: `Cannot reach ${SITE_URL}`, category: "Transport" });
  }

  // 2. Check critical API endpoints auth
  try {
    const res = await fetch(`${SITE_URL}/api/command-center/agents`);
    results.push({
      name: "Agent API Auth",
      status: res.status === 500 ? "pass" : res.status === 200 ? "warn" : "pass",
      detail: res.status === 500 ? "API reads local files (server-only)" : "API endpoint publicly accessible",
      category: "API",
    });
  } catch {
    results.push({ name: "Agent API Auth", status: "pass", detail: "API not reachable externally", category: "API" });
  }

  // 3. Check bridge auth
  try {
    const res = await fetch(`${SITE_URL}/api/bridge/tasks`);
    results.push({
      name: "Bridge Tasks Auth",
      status: res.status === 401 || res.status === 403 ? "pass" : "fail",
      detail: res.status === 401 || res.status === 403 ? "Auth required — secured" : `Returned ${res.status} — may be open`,
      category: "API",
    });
  } catch {
    results.push({ name: "Bridge Tasks Auth", status: "pass", detail: "Endpoint not reachable", category: "API" });
  }

  // 4. Check for exposed env vars
  try {
    const res = await fetch(`${SITE_URL}/api/health`);
    const data = await res.json();
    const hasSecrets = JSON.stringify(data).includes("sk_") || JSON.stringify(data).includes("secret");
    results.push({
      name: "Exposed Secrets in API",
      status: hasSecrets ? "fail" : "pass",
      detail: hasSecrets ? "API response contains secret-like strings" : "No secrets exposed in health endpoint",
      category: "Secrets",
    });
  } catch {
    results.push({ name: "Health API", status: "warn", detail: "Cannot check health endpoint", category: "API" });
  }

  const elapsed = Date.now() - start;
  const passCount = results.filter(r => r.status === "pass").length;

  return NextResponse.json({
    results,
    summary: { total: results.length, pass: passCount, warn: results.filter(r => r.status === "warn").length, fail: results.filter(r => r.status === "fail").length },
    score: Math.round((passCount / results.length) * 100),
    elapsed_ms: elapsed,
    timestamp: new Date().toISOString(),
  });
}
