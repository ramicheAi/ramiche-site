import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { fsUrl } from "@/lib/bridge-handlers";
import { fetchMeridianDashboardFromFirestore } from "@/lib/firebase-admin";

const DATA_PATH = join(
  process.env.HOME || "/Users/admin",
  ".openclaw/workspace/shared/artifacts/quantitative/dashboard_api.json"
);

function parseFirestoreMeridian(doc: { fields?: Record<string, { stringValue?: string }> }): unknown | null {
  const f = doc.fields;
  if (!f) return null;
  const raw =
    f.snapshot?.stringValue ??
    f.payloadJson?.stringValue ??
    f.dashboardJson?.stringValue;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isValidPayload(data: unknown): data is { portfolio: { equity: number } } {
  if (!data || typeof data !== "object") return false;
  const p = (data as { portfolio?: unknown }).portfolio;
  if (!p || typeof p !== "object") return false;
  return "equity" in p && typeof (p as { equity: unknown }).equity === "number";
}

export async function GET() {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw) as unknown;
    if (isValidPayload(data)) {
      return NextResponse.json(data);
    }
  } catch {
    /* try Firestore */
  }

  try {
    const res = await fetch(fsUrl("command-center/meridian"), { cache: "no-store" });
    if (res.ok) {
      const doc = (await res.json()) as { fields?: Record<string, { stringValue?: string }> };
      const data = parseFirestoreMeridian(doc);
      if (isValidPayload(data)) {
        return NextResponse.json(data, { headers: { "X-CC-Meridian-Source": "firestore-rest" } });
      }
    }
  } catch {
    /* fall through */
  }

  return NextResponse.json(
    {
      unavailable: true,
      message:
        "MERIDIAN snapshot not on this host. Sync `dashboard_api.json` via bridge or open Finance HQ from the machine that runs the SIMONS pipeline.",
    },
    { status: 200, headers: { "X-CC-Meridian-Source": "unavailable" } }
  );
}
