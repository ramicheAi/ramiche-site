// ── Task Approval API ───────────────────────────────────────────────
// POST: Approve/reject/create tasks from Command Center UI

import { NextRequest, NextResponse } from "next/server";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-athlete-73755";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BRIDGE_SECRET = process.env.BRIDGE_API_SECRET || "parallax-bridge-2026";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-bridge-secret");
  if (authHeader !== BRIDGE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { action, taskId, title, description, assignee, priority, status } = await req.json();

    if (action === "create") {
      if (!title) {
        return NextResponse.json({ error: "title required" }, { status: 400 });
      }

      const id = `task_${Date.now()}`;
      const taskData = {
        fields: {
          id: { stringValue: id },
          title: { stringValue: title },
          description: { stringValue: description || "" },
          assignee: { stringValue: assignee || "unassigned" },
          priority: { stringValue: priority || "medium" },
          status: { stringValue: "backlog" },
          createdAt: { stringValue: new Date().toISOString() },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      };

      await fetch(`${FIRESTORE_BASE}/command-center-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      return NextResponse.json({ ok: true, id, action: "created" });
    }

    if (action === "approve" || action === "reject" || action === "update") {
      if (!taskId) {
        return NextResponse.json({ error: "taskId required" }, { status: 400 });
      }

      const updateFields: Record<string, { stringValue: string }> = {
        updatedAt: { stringValue: new Date().toISOString() },
      };

      if (action === "approve") {
        updateFields.status = { stringValue: "approved" };
        updateFields.approvedAt = { stringValue: new Date().toISOString() };
      } else if (action === "reject") {
        updateFields.status = { stringValue: "rejected" };
      } else if (status) {
        updateFields.status = { stringValue: status };
      }

      if (assignee) updateFields.assignee = { stringValue: assignee };
      if (priority) updateFields.priority = { stringValue: priority };

      await fetch(`${FIRESTORE_BASE}/command-center-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: updateFields }),
      });

      return NextResponse.json({ ok: true, taskId, action });
    }

    if (action === "delete") {
      if (!taskId) {
        return NextResponse.json({ error: "taskId required" }, { status: 400 });
      }

      await fetch(`${FIRESTORE_BASE}/command-center-tasks/${taskId}`, {
        method: "DELETE",
      });

      return NextResponse.json({ ok: true, taskId, action: "deleted" });
    }

    return NextResponse.json({ error: "action must be create/approve/reject/update/delete" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const res = await fetch(
      `${FIRESTORE_BASE}/command-center-tasks?pageSize=100`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ items: [] });

    const data = await res.json();
    const tasks = (data.documents || []).map((doc: { fields: Record<string, { stringValue?: string }> }) => {
      const f = doc.fields || {};
      return {
        id: f.id?.stringValue || "",
        title: f.title?.stringValue || "",
        description: f.description?.stringValue || "",
        assignee: f.assignee?.stringValue || "unassigned",
        priority: f.priority?.stringValue || "medium",
        status: f.status?.stringValue || "backlog",
        createdAt: f.createdAt?.stringValue || "",
        updatedAt: f.updatedAt?.stringValue || "",
      };
    });

    return NextResponse.json({ items: tasks, count: tasks.length });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) });
  }
}
