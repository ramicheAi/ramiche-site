// ── Bridge API: Command Center Live Data ──────────────────────────
// POST: Accept workspace state from local sync script, store in Firestore REST API
// GET: Proxy read from Firestore for Command Center pages
//
// Uses Firestore REST API — no Admin SDK needed

import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET || "parallax-bridge-2026";

export const dynamic = "force-dynamic";

// Helper: Convert JS object to Firestore document fields format
function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      fields[key] = { stringValue: value };
    } else if (typeof value === "number") {
      fields[key] = { integerValue: String(value) };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map((v) =>
            typeof v === "object" && v !== null
              ? { mapValue: { fields: toFirestoreFields(v as Record<string, unknown>) } }
              : typeof v === "string"
              ? { stringValue: v }
              : typeof v === "number"
              ? { integerValue: String(v) }
              : { stringValue: String(v) }
          ),
        },
      };
    } else if (typeof value === "object" && value !== null) {
      fields[key] = {
        mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) },
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

// Helper: Convert Firestore document to JS object
function fromFirestoreFields(fields: Record<string, Record<string, unknown>>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if ("stringValue" in value) result[key] = value.stringValue;
    else if ("integerValue" in value) result[key] = Number(value.integerValue);
    else if ("booleanValue" in value) result[key] = value.booleanValue;
    else if ("mapValue" in value) {
      const mv = value.mapValue as { fields: Record<string, Record<string, unknown>> };
      result[key] = mv.fields ? fromFirestoreFields(mv.fields) : {};
    } else if ("arrayValue" in value) {
      const av = value.arrayValue as { values?: Array<Record<string, unknown>> };
      result[key] = (av.values || []).map((v) => {
        if ("stringValue" in v) return v.stringValue;
        if ("integerValue" in v) return Number(v.integerValue);
        if ("mapValue" in v) {
          const mv = v.mapValue as { fields: Record<string, Record<string, unknown>> };
          return mv.fields ? fromFirestoreFields(mv.fields) : {};
        }
        return v;
      });
    } else {
      result[key] = null;
    }
  }
  return result;
}

// GET: Read current bridge state
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";
  const validTypes = ["agents", "crons", "activity", "projects", "links", "missions", "schedule", "notifications", "opportunities"];

  try {
    if (type === "all") {
      const results = await Promise.all(
        validTypes.map(async (t) => {
          const res = await fetch(`${FIRESTORE_BASE}/command-center/${t}`, {
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (!res.ok) return [t, null];
          const doc = await res.json();
          return [t, doc.fields ? fromFirestoreFields(doc.fields) : null];
        })
      );
      const data = Object.fromEntries(results);
      return NextResponse.json({ ...data, _syncedAt: new Date().toISOString() });
    }

    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `invalid type. use: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const res = await fetch(`${FIRESTORE_BASE}/command-center/${type}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    const doc = await res.json();
    return NextResponse.json(doc.fields ? fromFirestoreFields(doc.fields) : {});
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: Sync data from local machine
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-bridge-secret");
  if (authHeader !== BRIDGE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: "type and data required" }, { status: 400 });
    }

    const validTypes = ["agents", "crons", "activity", "projects", "memory", "links", "missions", "schedule", "notifications", "opportunities"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `invalid type. use: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const enrichedData = {
      ...data,
      _syncedAt: new Date().toISOString(),
      _source: "bridge-sync",
    };

    const fields = toFirestoreFields(enrichedData);

    const res = await fetch(`${FIRESTORE_BASE}/command-center/${type}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    return NextResponse.json({ ok: true, type, syncedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
