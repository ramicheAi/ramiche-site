import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function checkPrerequisite(id: string): { status: "configured" | "not-configured"; detail: string } {
  switch (id) {
    case "apple-dev": {
      const hasTeamId = !!process.env.APPLE_DEVELOPER_TEAM_ID;
      const hasCerts = safe(() => {
        const out = execSync("security find-identity -v -p codesigning 2>/dev/null | head -5", { encoding: "utf-8", timeout: 5000 });
        return out.includes("valid identities found") ? false : out.trim().length > 10;
      }, false);
      return {
        status: hasTeamId || hasCerts ? "configured" : "not-configured",
        detail: hasTeamId ? `Team ID: ${process.env.APPLE_DEVELOPER_TEAM_ID}` : hasCerts ? "Code signing identities found" : "No APPLE_DEVELOPER_TEAM_ID env var or code signing identities",
      };
    }
    case "app-store-api": {
      const hasKey = !!process.env.APP_STORE_CONNECT_API_KEY;
      const hasKeyFile = existsSync(`${process.env.HOME}/.appstoreconnect/private_keys/`) ||
                         existsSync(`${process.env.HOME}/private_keys/AuthKey.p8`);
      return {
        status: hasKey || hasKeyFile ? "configured" : "not-configured",
        detail: hasKey ? "API key env var set" : hasKeyFile ? "Key file found" : "No API key configured",
      };
    }
    case "eas-cli": {
      const easPath = safe(() => execSync("which eas 2>/dev/null", { encoding: "utf-8", timeout: 3000 }).trim(), "");
      const version = easPath ? safe(() => execSync("eas --version 2>/dev/null", { encoding: "utf-8", timeout: 3000 }).trim(), "") : "";
      return {
        status: easPath ? "configured" : "not-configured",
        detail: easPath ? `EAS CLI at ${easPath} (${version})` : "EAS CLI not found. Install with: npm install -g eas-cli",
      };
    }
    case "expo-project": {
      const hasAppJson = existsSync("./app.json") || existsSync("./app.config.js") || existsSync("./app.config.ts");
      return {
        status: hasAppJson ? "configured" : "not-configured",
        detail: hasAppJson ? "Expo project detected" : "No app.json or app.config found in current directory",
      };
    }
    default:
      return { status: "not-configured", detail: "Unknown prerequisite" };
  }
}

export async function GET() {
  const prerequisites = ["apple-dev", "app-store-api", "eas-cli", "expo-project"].map(id => ({
    id,
    ...checkPrerequisite(id),
  }));

  const allConfigured = prerequisites.every(p => p.status === "configured");

  return NextResponse.json({
    prerequisites,
    allConfigured,
    checkedAt: new Date().toISOString(),
  });
}
