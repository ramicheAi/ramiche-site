import { NextRequest, NextResponse } from "next/server";
import { fsUrl, toFirestoreFields, fromFirestoreFields } from "@/lib/firestore-bridge-rest";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 50;

type NotifyKind = "approve" | "reject" | "revise";

type NotifyBody = {
  kind?: string;
  taskId?: string;
  title?: string;
  description?: string;
  assignee?: string;
  reason?: string;
};

/** Appends a task-outcome line to Firestore `command-center/notifications` (main hub feed). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NotifyBody;
    const kind = body.kind as NotifyKind | undefined;
    if (kind !== "approve" && kind !== "reject" && kind !== "revise") {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }

    const res = await fetch(fsUrl("command-center/notifications"), {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    let items: Record<string, unknown>[] = [];
    if (res.ok) {
      const doc = await res.json();
      if (doc.fields) {
        const parsed = fromFirestoreFields(doc.fields);
        const raw = parsed.items;
        if (Array.isArray(raw)) {
          items = raw.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
        }
      }
    }

    const labels = {
      approve: { accent: "#22c55e", icon: "✓", label: "Approved" },
      reject: { accent: "#ef4444", icon: "✗", label: "Rejected" },
      revise: { accent: "#f59e0b", icon: "↻", label: "Revision" },
    } as const;

    const meta = labels[kind];
    const taskLabel = (body.title || body.taskId || "task").slice(0, 200);
    const text =
      kind === "revise" && body.reason
        ? `${meta.label}: ${taskLabel} — ${body.reason.slice(0, 200)}`
        : `${meta.label}: ${taskLabel}${body.assignee ? ` (${body.assignee})` : ""}`;

    items.unshift({
      text,
      accent: meta.accent,
      icon: meta.icon,
      _at: new Date().toISOString(),
    });
    items = items.slice(0, MAX_ITEMS);

    const writeRes = await fetch(fsUrl("command-center/notifications"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: toFirestoreFields({
          items,
          _updatedAt: new Date().toISOString(),
          _source: "command-center-tasks-notify",
        }),
      }),
    });

    if (!writeRes.ok) {
      const errText = await writeRes.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: "persist failed", detail: errText.slice(0, 200) },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
