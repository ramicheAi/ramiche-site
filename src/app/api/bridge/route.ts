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
  const validTypes = ["agents", "crons", "activity", "projects", "links", "missions", "schedule", "notifications", "opportunities", "tasks"];

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

// PATCH: Update task status (move, approve, create) from Command Center UI
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, taskId, fromCol, toCol, task } = body;

    // Read current tasks from Firestore
    const tasksRes = await fetch(`${FIRESTORE_BASE}/command-center/tasks`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    let currentTasks: Record<string, unknown[]> = { backlog: [], "in-progress": [], review: [], done: [] };
    if (tasksRes.ok) {
      const doc = await tasksRes.json();
      if (doc.fields) {
        const parsed = fromFirestoreFields(doc.fields);
        currentTasks = {
          backlog: (parsed.backlog as unknown[]) || [],
          "in-progress": (parsed["in-progress"] as unknown[]) || [],
          review: (parsed.review as unknown[]) || [],
          done: (parsed.done as unknown[]) || [],
        };
      }
    }

    if (action === "move" && taskId && fromCol && toCol) {
      // Move task between columns
      const fromTasks = (currentTasks[fromCol] as Array<Record<string, unknown>>) || [];
      const taskIndex = fromTasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) {
        return NextResponse.json({ error: "task not found in source column" }, { status: 404 });
      }
      const [movedTask] = fromTasks.splice(taskIndex, 1);
      if (toCol === "done") {
        (movedTask as Record<string, unknown>).completedAt = new Date().toISOString().split("T")[0];
      }
      const toTasks = (currentTasks[toCol] as unknown[]) || [];
      toTasks.push(movedTask);
      currentTasks[fromCol] = fromTasks;
      currentTasks[toCol] = toTasks;
    } else if (action === "create" && task) {
      // Add new task to backlog
      const newTask = {
        id: `task-${Date.now()}`,
        ...task,
        createdAt: new Date().toISOString().split("T")[0],
      };
      (currentTasks.backlog as unknown[]).push(newTask);
    } else if (action === "approve" && taskId) {
      // Move from backlog to in-progress (approve/start)
      const backlog = (currentTasks.backlog as Array<Record<string, unknown>>) || [];
      const idx = backlog.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        const [approved] = backlog.splice(idx, 1);
        (currentTasks["in-progress"] as unknown[]).push(approved);
      }
    } else if (action === "trigger") {
      // Trigger an agent: move task to in-progress + write to trigger queue for local relay
      const { agent, title, description, fromCol: triggerFrom } = body;
      const srcCol = triggerFrom || "backlog";
      const srcTasks = (currentTasks[srcCol] as Array<Record<string, unknown>>) || [];
      const tIdx = srcTasks.findIndex((t) => t.id === taskId);
      if (tIdx !== -1) {
        const [triggered] = srcTasks.splice(tIdx, 1);
        triggered.startedAt = new Date().toISOString();
        (currentTasks["in-progress"] as unknown[]).push(triggered);
        currentTasks[srcCol] = srcTasks;
      }
      // Write trigger to Firestore queue — bridge sync reads this and writes to agents/inbox.md
      const triggerEntry = {
        taskId: taskId || `task-${Date.now()}`,
        agent: agent || "Atlas",
        title: title || "Untitled task",
        description: description || "",
        triggeredAt: new Date().toISOString(),
        status: "pending",
      };
      await fetch(`${FIRESTORE_BASE}/command-center/trigger-queue`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: toFirestoreFields({
            pending: [triggerEntry],
            _updatedAt: new Date().toISOString(),
          }),
        }),
      }).catch(() => {});
      // Fall through to persist task move below
    } else {
      return NextResponse.json({ error: "invalid action. use: move, create, approve, trigger" }, { status: 400 });
    }

    // Write updated tasks back to Firestore
    const fields = toFirestoreFields({
      ...currentTasks,
      _updatedAt: new Date().toISOString(),
      _source: "command-center-ui",
    });

    const writeRes = await fetch(`${FIRESTORE_BASE}/command-center/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    if (!writeRes.ok) {
      return NextResponse.json({ error: "failed to write tasks" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action, tasks: currentTasks });
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

    const validTypes = ["agents", "crons", "activity", "projects", "memory", "links", "missions", "schedule", "notifications", "opportunities", "tasks"];
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
