/**
 * Streaming Phase C+F approval — SSE.
 *
 * POST /api/command-center/chat/approve/stream  body: { messageId: string }
 *
 * Why this exists alongside /approve: the non-streaming sibling executes the
 * full plan in one shot and returns only when every action has been dispatched
 * and verified. For 5+ actions × dispatch + verifier + retry, that exceeds
 * the route's maxDuration (120s) and the client sees HTTP 504 even though
 * action_statuses ARE getting persisted to Supabase in the background.
 *
 * This endpoint keeps the connection open for the lifetime of the run and
 * streams ApproveEvent frames as each action progresses. The UI binds these
 * events to the synthesis card's action pills so they flip pending →
 * in_progress → done in real time. If the client disconnects, the server
 * keeps running until completion and persists final statuses regardless —
 * the UI's polling fallback picks up where it left off.
 *
 * Wire format (text/event-stream):
 *   event: plan_loaded     data: { total, mode }
 *   event: action_start    data: { actionIndex, owner, task, attempt }
 *   event: deliverable     data: { actionIndex, owner, via, attempt, preview, length }
 *   event: verifying       data: { actionIndex, owner }
 *   event: verdict         data: { actionIndex, owner, meetsDefinition, gaps, revisions }
 *   event: action_done     data: { actionIndex, owner, status, attempts }
 *   event: complete        data: { executed, blocked, total, mode }
 *   event: error           data: { error }
 */

import { NextRequest } from "next/server";
import {
  approveSynthesisMessageStreamed,
  type ApproveEvent,
} from "@/lib/cc-approve-synthesis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Streamed approval can legitimately run for several minutes when the plan
// uses sequential mode or many actions trigger retries. The SSE connection
// itself keeps Vercel from killing the function as long as we emit chunks.
export const maxDuration = 300;

function sseFrame(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let messageId = "";
  try {
    const body = (await req.json()) as { messageId?: string };
    messageId = String(body.messageId || "");
  } catch {
    return new Response(sseFrame("error", { error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Heartbeat every 10s so the connection survives any intermediate proxy
      // that might time out idle WS-like streams. The empty SSE comment is
      // valid per the spec and ignored by EventSource clients.
      const heartbeat = setInterval(() => {
        if (closed) return;
        safeEnqueue(`: heartbeat ${Date.now()}\n\n`);
      }, 10_000);

      const onEvent = (event: ApproveEvent) => {
        safeEnqueue(sseFrame(event.type, event));
      };

      try {
        const result = await approveSynthesisMessageStreamed(messageId, onEvent);
        if (!result.ok) {
          safeEnqueue(sseFrame("error", { error: result.error, status: result.status }));
        }
      } catch (err) {
        safeEnqueue(sseFrame("error", { error: String(err) }));
      } finally {
        clearInterval(heartbeat);
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
        closed = true;
      }
    },
    cancel() {
      // Client disconnected. Server keeps running because we don't propagate
      // the cancel into approveSynthesisMessageStreamed — final statuses will
      // still be persisted to Supabase and the UI's polling fallback recovers.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      accepts: ["POST"],
      contentType: "text/event-stream",
      events: [
        "plan_loaded",
        "action_start",
        "deliverable",
        "verifying",
        "verdict",
        "action_done",
        "complete",
        "error",
      ],
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
