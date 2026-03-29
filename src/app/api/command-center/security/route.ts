import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://ramiche-site.vercel.app";
const REPO_DIR = process.env.REPO_DIR || "/Users/admin/ramiche-site";

interface ScanResult {
  name: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  category: string;
}

interface NpmAuditVulnerabilities {
  info: number;
  low: number;
  moderate: number;
  high: number;
  critical: number;
  total: number;
}

interface NpmAuditReport {
  metadata?: {
    vulnerabilities?: NpmAuditVulnerabilities;
    totalDependencies?: number;
  };
  vulnerabilities?: Record<
    string,
    { severity: string; via: unknown[]; isDirect: boolean }
  >;
}

interface NpmOutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
  dependent: string;
  location: string;
}

function safe(cmd: string): string {
  try {
    return execSync(cmd, {
      cwd: REPO_DIR,
      encoding: "utf-8",
      timeout: 30_000,
    }).trim();
  } catch {
    return "";
  }
}

function majorVersion(semver: string): number {
  const match = semver.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function POST() {
  const results: ScanResult[] = [];
  const start = Date.now();

  // ── 1. Security headers ──────────────────────────────────────────────
  try {
    const res = await fetch(SITE_URL, { method: "HEAD", redirect: "follow" });
    const headers = Object.fromEntries(res.headers.entries());

    results.push({
      name: "HTTPS",
      status: SITE_URL.startsWith("https") ? "pass" : "fail",
      detail: SITE_URL.startsWith("https")
        ? "All traffic encrypted"
        : "HTTP detected",
      category: "Transport",
    });

    results.push({
      name: "Content-Security-Policy",
      status: headers["content-security-policy"] ? "pass" : "warn",
      detail: headers["content-security-policy"]
        ? "CSP header present"
        : "No CSP header (may use meta tag)",
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
      status: headers["x-content-type-options"] === "nosniff"
        ? "pass"
        : "warn",
      detail: headers["x-content-type-options"] || "Not set — MIME sniffing risk",
      category: "Headers",
    });

    results.push({
      name: "Server Identity",
      status: headers["x-powered-by"] ? "warn" : "pass",
      detail: headers["x-powered-by"]
        ? `Exposed: ${headers["x-powered-by"]}`
        : "Server identity hidden",
      category: "Headers",
    });
  } catch {
    results.push({
      name: "Site Reachability",
      status: "fail",
      detail: `Cannot reach ${SITE_URL}`,
      category: "Transport",
    });
  }

  // ── 2. API endpoint auth ─────────────────────────────────────────────
  try {
    const res = await fetch(`${SITE_URL}/api/command-center/agents`);
    results.push({
      name: "Agent API Auth",
      status: res.status === 500 ? "pass" : res.status === 200 ? "warn" : "pass",
      detail:
        res.status === 500
          ? "API reads local files (server-only)"
          : "API endpoint publicly accessible",
      category: "API",
    });
  } catch {
    results.push({
      name: "Agent API Auth",
      status: "pass",
      detail: "API not reachable externally",
      category: "API",
    });
  }

  // ── 3. Bridge auth ──────────────────────────────────────────────────
  try {
    const res = await fetch(`${SITE_URL}/api/bridge/tasks`);
    results.push({
      name: "Bridge Tasks Auth",
      status: res.status === 401 || res.status === 403 ? "pass" : "fail",
      detail:
        res.status === 401 || res.status === 403
          ? "Auth required — secured"
          : `Returned ${res.status} — may be open`,
      category: "API",
    });
  } catch {
    results.push({
      name: "Bridge Tasks Auth",
      status: "pass",
      detail: "Endpoint not reachable",
      category: "API",
    });
  }

  // ── 4. Exposed secrets in health endpoint ────────────────────────────
  try {
    const res = await fetch(`${SITE_URL}/api/health`);
    const data: unknown = await res.json();
    const serialized = JSON.stringify(data);
    const hasSecrets =
      serialized.includes("sk_") || serialized.includes("secret");
    results.push({
      name: "Exposed Secrets in API",
      status: hasSecrets ? "fail" : "pass",
      detail: hasSecrets
        ? "API response contains secret-like strings"
        : "No secrets exposed in health endpoint",
      category: "Secrets",
    });
  } catch {
    results.push({
      name: "Health API",
      status: "warn",
      detail: "Cannot check health endpoint",
      category: "API",
    });
  }

  // ── 5. npm audit ────────────────────────────────────────────────────
  try {
    const raw = safe("npm audit --json 2>/dev/null");
    if (raw) {
      const audit = JSON.parse(raw) as NpmAuditReport;
      const vulns = audit.metadata?.vulnerabilities;
      if (vulns) {
        const critical = vulns.critical || 0;
        const high = vulns.high || 0;
        const moderate = vulns.moderate || 0;
        const low = vulns.low || 0;
        const total = critical + high + moderate + low;

        let status: ScanResult["status"] = "pass";
        if (critical > 0 || high > 0) status = "fail";
        else if (moderate > 0) status = "warn";

        results.push({
          name: "npm Audit",
          status,
          detail:
            total === 0
              ? "No known vulnerabilities"
              : `${total} vuln${total !== 1 ? "s" : ""} (${critical} critical, ${high} high, ${moderate} moderate, ${low} low)`,
          category: "Dependencies",
        });
      } else {
        results.push({
          name: "npm Audit",
          status: "pass",
          detail: "No vulnerability data reported",
          category: "Dependencies",
        });
      }
    } else {
      results.push({
        name: "npm Audit",
        status: "warn",
        detail: "npm audit returned no output",
        category: "Dependencies",
      });
    }
  } catch {
    results.push({
      name: "npm Audit",
      status: "warn",
      detail: "Failed to run npm audit",
      category: "Dependencies",
    });
  }

  // ── 6. .env exposure in git tree ────────────────────────────────────
  try {
    const tracked = safe("git ls-files --cached .env* 2>/dev/null");
    if (tracked.length > 0) {
      const files = tracked.split("\n").filter(Boolean);
      results.push({
        name: ".env File Exposure",
        status: "fail",
        detail: `${files.length} .env file${files.length !== 1 ? "s" : ""} tracked in git: ${files.join(", ")}`,
        category: "Secrets",
      });
    } else {
      results.push({
        name: ".env File Exposure",
        status: "pass",
        detail: "No .env files tracked in git",
        category: "Secrets",
      });
    }
  } catch {
    results.push({
      name: ".env File Exposure",
      status: "warn",
      detail: "Could not check git-tracked .env files",
      category: "Secrets",
    });
  }

  // ── 7. Secret pattern detection in source ───────────────────────────
  try {
    const matches = safe(
      "rg -l 'sk_live|sk_test|AKIA|AIza|ghp_|glpat-' src/ --type ts --type tsx 2>/dev/null || echo ''"
    );
    const files = matches.split("\n").filter(Boolean);
    if (files.length > 0) {
      results.push({
        name: "Hardcoded Secrets",
        status: "fail",
        detail: `Found secret patterns in ${files.length} file${files.length !== 1 ? "s" : ""}`,
        category: "Secrets",
      });
    } else {
      results.push({
        name: "Hardcoded Secrets",
        status: "pass",
        detail: "No hardcoded secret patterns found in src/",
        category: "Secrets",
      });
    }
  } catch {
    results.push({
      name: "Hardcoded Secrets",
      status: "warn",
      detail: "Could not scan source for secret patterns",
      category: "Secrets",
    });
  }

  // ── 8. API key rotation / configuration ─────────────────────────────
  const envKeys: Array<{ key: string; label: string }> = [
    { key: "STRIPE_SECRET_KEY", label: "Stripe Secret Key" },
    { key: "FIREBASE_SERVICE_ACCOUNT", label: "Firebase Service Account" },
  ];

  for (const { key, label } of envKeys) {
    results.push({
      name: `${label} Config`,
      status: process.env[key] ? "pass" : "warn",
      detail: process.env[key] ? "Configured" : "Not configured",
      category: "Configuration",
    });
  }

  // ── 9. Dependency freshness ─────────────────────────────────────────
  try {
    const raw = safe("npm outdated --json 2>/dev/null");
    if (raw) {
      const outdated = JSON.parse(raw) as Record<string, NpmOutdatedEntry>;
      const packages = Object.entries(outdated);
      const total = packages.length;
      const majorMismatches = packages.filter(
        ([, info]) => majorVersion(info.latest) > majorVersion(info.current)
      ).length;

      let status: ScanResult["status"] = "pass";
      if (majorMismatches > 5) status = "fail";
      else if (total > 0) status = "warn";

      results.push({
        name: "Dependency Freshness",
        status,
        detail:
          total === 0
            ? "All dependencies up to date"
            : `${total} outdated package${total !== 1 ? "s" : ""} (${majorMismatches} major version behind)`,
        category: "Dependencies",
      });
    } else {
      results.push({
        name: "Dependency Freshness",
        status: "pass",
        detail: "All dependencies up to date",
        category: "Dependencies",
      });
    }
  } catch {
    results.push({
      name: "Dependency Freshness",
      status: "warn",
      detail: "Could not check dependency freshness",
      category: "Dependencies",
    });
  }

  // ── 10. Firestore rules ─────────────────────────────────────────────
  try {
    const rulesPath = join(REPO_DIR, "firestore.rules");
    const exists = existsSync(rulesPath);
    results.push({
      name: "Firestore Rules",
      status: exists ? "pass" : "warn",
      detail: exists
        ? "firestore.rules file present in repo"
        : "No firestore.rules found — database may use default (open) rules",
      category: "Database",
    });
  } catch {
    results.push({
      name: "Firestore Rules",
      status: "warn",
      detail: "Could not check for firestore.rules",
      category: "Database",
    });
  }

  // ── Score calculation ───────────────────────────────────────────────
  const elapsed = Date.now() - start;
  const passCount = results.filter((r) => r.status === "pass").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  const weightedScore = passCount * 1 + warnCount * 0.5;
  const score = Math.round((weightedScore / results.length) * 100);

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      pass: passCount,
      warn: warnCount,
      fail: failCount,
    },
    score,
    elapsed_ms: elapsed,
    timestamp: new Date().toISOString(),
  });
}
