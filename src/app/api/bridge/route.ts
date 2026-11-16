// ── Bridge API: Command Center Live Data ──────────────────────────
// POST: Accept workspace state from local sync script, store in Firestore REST API
// GET: Proxy read from Firestore for Command Center pages
//
// Uses Firestore REST API — no Admin SDK needed

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { fsUrl, toFirestoreFields, fromFirestoreFields } from "@/lib/firestore-bridge-rest";
import { ownerOnly } from "@/lib/server/command-center-guard";
import { timingSafeSecretEqual } from "@/lib/server/command-center-auth";

/**
 * First 8 hex chars of sha256(secret) — never the secret itself. Logged
 * server-side only (never in a response body) on an auth failure, so a
 * credential mismatch between this deployment's BRIDGE_API_SECRET and the
 * sender's can be confirmed from Vercel's function logs against the
 * sender's own startup fingerprint log (scripts/bridge-sync.mjs), per
 * docs/bridge/CC-BRIDGE-PROJECT-TRUTH-01.md section 6 (R1).
 *
 * Normalizes identically to timingSafeSecretEqual's own inputs (trim +
 * strip a trailing literal "\n") before hashing, so this fingerprint can
 * never show a "mismatch" for a secret that would actually pass the real
 * comparison (independent review finding).
 */
function secretFingerprint(secret: string): string {
  const normalized = (secret || "").trim().replace(/\\n$/, "");
  if (!normalized) return "(unset)";
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 8);
}

/**
 * Firestore's REST `updateTime` trims trailing zeros in its fractional
 * seconds (0, 3, 6 or 9 digits), so two genuinely-ordered timestamps like
 * "...00.500Z" and "...00.500001Z" do NOT always compare correctly as
 * plain strings ("Z" sorts above "0"). Parse to milliseconds-since-epoch
 * plus the leftover sub-millisecond digits as an integer, and compare
 * numerically (independent review finding).
 */
function parseFirestoreTimestamp(ts: string): { ms: number; subMs: number } | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$/.exec(ts);
  if (!match) return undefined;
  const whole = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(whole)) return undefined;
  const frac = (match[2] || "").padEnd(9, "0"); // nanoseconds, zero-padded
  const ms = whole + Number(frac.slice(0, 3));
  const subMs = Number(frac.slice(3)); // remaining micro/nanosecond digits
  return { ms, subMs };
}

function timestampGte(a: string, b: string): boolean {
  const pa = parseFirestoreTimestamp(a);
  const pb = parseFirestoreTimestamp(b);
  if (!pa || !pb) return a >= b; // fall back to lexicographic if unparseable
  if (pa.ms !== pb.ms) return pa.ms > pb.ms;
  return pa.subMs >= pb.subMs;
}

const BRIDGE_SECRET = (process.env.BRIDGE_API_SECRET || "").trim().replace(/\\n$/, "");

// Logged ONCE at module load, not per-request: an unauthenticated caller
// spamming 401s must not be able to flood the function logs with repeated
// identical lines (independent review finding).
const CONFIGURED_SECRET_FINGERPRINT = secretFingerprint(BRIDGE_SECRET);

export const dynamic = "force-dynamic";

// GET: Read current bridge state
async function GET_handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "all";
  const validTypes = ["agents", "crons", "activity", "agentActivity", "projects", "links", "missions", "schedule", "notifications", "opportunities", "tasks"];

  try {
    if (type === "all") {
      const results = await Promise.all(
        validTypes.map(async (t) => {
          const res = await fetch(fsUrl(`command-center/${t}`), {
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (!res.ok) return [t, null];
          const doc = await res.json();
          return [t, doc.fields ? fromFirestoreFields(doc.fields) : null];
        })
      );
      const data: Record<string, unknown> = Object.fromEntries(results);
      // agentActivity stores items as JSON string to avoid Firestore nested map limits
      if (data.agentActivity && typeof data.agentActivity === "object") {
        const aa = data.agentActivity as Record<string, unknown>;
        if (typeof aa.itemsJson === "string") {
          try { aa.items = JSON.parse(aa.itemsJson); } catch { aa.items = []; }
          delete aa.itemsJson;
        }
      }
      return NextResponse.json({ ...data, _syncedAt: new Date().toISOString() });
    }

    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `invalid type. use: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const res = await fetch(fsUrl(`command-center/${type}`), {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      // Firestore returns 404 when the doc hasn't been seeded yet, and 403
      // when read rules deny anonymous access. Treat both as an empty payload
      // (200) so dashboards render their fallback state instead of throwing
      // red console errors and breaking the layout. True upstream failures
      // (5xx) still surface so we can debug them.
      if (res.status === 404 || res.status === 403 || res.status === 401) {
        return NextResponse.json({ items: [], _empty: true, _upstream: res.status });
      }
      return NextResponse.json(
        { error: `firestore upstream ${res.status}` },
        { status: 502 },
      );
    }
    const doc = await res.json();
    return NextResponse.json(doc.fields ? fromFirestoreFields(doc.fields) : {});
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH: Update task status (move, approve, create) from Command Center UI
async function PATCH_handler(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, taskId, fromCol, toCol, task } = body;

    // Read current tasks from Firestore
    const tasksRes = await fetch(fsUrl("command-center/tasks"), {
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
      await fetch(fsUrl("command-center/trigger-queue"), {
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

    const writeRes = await fetch(fsUrl("command-center/tasks"), {
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
  // Machine sync (launchd bridge-sync, scripts): secret-gated, timing-safe, fails closed when unset.
  const authHeader = (req.headers.get("x-bridge-secret") || "").trim().replace(/\\n$/, "");
  if (!timingSafeSecretEqual(authHeader, BRIDGE_SECRET)) {
    // Server log only (never the response body): lets a credential mismatch
    // be confirmed by comparing fingerprints, without exposing either secret.
    console.error(
      `[bridge] POST unauthorized — configured secret fingerprint ${CONFIGURED_SECRET_FINGERPRINT}, ` +
      `received fingerprint ${secretFingerprint(authHeader)}`
    );
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ error: "type and data required" }, { status: 400 });
    }

    const validTypes = ["agents", "crons", "activity", "agentActivity", "projects", "memory", "links", "missions", "schedule", "notifications", "opportunities", "tasks"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `invalid type. use: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const enrichedData = {
      ...data,
      _syncedAt: new Date().toISOString(),
      _source: "bridge-sync",
    };

    const fields = toFirestoreFields(enrichedData);

    const res = await fetch(fsUrl(`command-center/${type}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      // Log the raw Firestore error server-side only; never echo it in the
      // response. A pass-through of Firestore's own 401/403 also used to be
      // indistinguishable from this route's own bridge-secret 401, which
      // sends anyone debugging a fingerprint mismatch down the wrong path —
      // always answer with this route's own fixed 502 (independent review
      // finding).
      const errText = await res.text();
      console.error(`[bridge] POST ${type} upstream write failed (${res.status}):`, errText);
      return NextResponse.json({ error: "upstream_write_failed" }, { status: res.status });
    }

    // A 2xx from Firestore's PATCH endpoint means Firestore ACCEPTED the write
    // (receiver_accepted) — it does not, on its own, prove a later reader sees
    // it. Read the doc back and compare `updateTime` to actually VERIFY
    // persistence (persisted_verified), rather than trusting the write
    // acknowledgment alone. This stays entirely server-side (machine-secret
    // authenticated already by timingSafeSecretEqual above) — no new
    // exposure, one extra Firestore GET per collection per 60s cycle.
    let updateTime: string | undefined;
    let persistedVerified = false;
    let verifyError: string | undefined;
    try {
      const written = await res.json();
      updateTime = typeof written?.updateTime === "string" ? written.updateTime : undefined;

      if (!updateTime) {
        // The write succeeded but Firestore's response didn't carry an
        // updateTime to verify against — distinct from a readback that ran
        // and genuinely mismatched (independent review finding).
        verifyError = "no_update_time";
      } else {
        // Bounded: a hung Firestore readback must not tie up this function
        // indefinitely (independent review finding).
        const readback = await fetch(fsUrl(`command-center/${type}`), {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (readback.ok) {
          const doc = await readback.json();
          // "Later or equal," not "exactly equal": Firestore's updateTime is
          // a canonical RFC3339 UTC timestamp (fixed-width, always "Z"),
          // which sorts correctly as a string. A concurrent writer (e.g. the
          // Command Center UI moving a task between this PATCH and this
          // readback) can legitimately bump updateTime again; that is still
          // proof THIS write persisted, not a verification failure
          // (independent review finding — the exact-match version flapped
          // "unverified" on every concurrent write to a shared collection
          // like `tasks`).
          const readTime = typeof doc?.updateTime === "string" ? doc.updateTime : undefined;
          persistedVerified = !!readTime && timestampGte(readTime, updateTime);
          if (!persistedVerified) verifyError = "readback_mismatch";
        } else {
          verifyError = `readback_${readback.status}`;
        }
      }
    } catch (e) {
      // Never echo the raw exception text in the response (it's authenticated
      // already, but a fixed code avoids leaking internal detail to any
      // caller; the full error still reaches the server log for debugging —
      // independent review finding).
      console.error(`[bridge] POST ${type} readback-verification exception:`, e);
      verifyError = e instanceof Error && e.name === "TimeoutError" ? "readback_timeout" : "readback_exception";
    }

    return NextResponse.json({
      ok: true,
      type,
      syncedAt: new Date().toISOString(),
      receiverAccepted: true,
      updateTime,
      persistedVerified,
      ...(verifyError ? { verifyError } : {}),
    });
  } catch (e) {
    console.error(`[bridge] POST exception:`, e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// Owner-only at the handler (CC-SECURITY-RECONCILIATION-02, independent review B1/B2).
export const GET = ownerOnly(GET_handler);
export const PATCH = ownerOnly(PATCH_handler);
