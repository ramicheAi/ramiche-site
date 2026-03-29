import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BusMessage {
  id: string;
  from: string;
  to: string;
  type: "command" | "query" | "response" | "broadcast";
  payload: string;
  metadata?: Record<string, string>;
  timestamp: number;
}

interface IncomingMessage {
  from: string;
  to: string;
  type: "command" | "query" | "response" | "broadcast";
  payload: string;
  metadata?: Record<string, string>;
}

const MESSAGE_TTL_MS = 5 * 60 * 1000;

const messageQueue: BusMessage[] = [];

function pruneExpired(): void {
  const cutoff = Date.now() - MESSAGE_TTL_MS;
  let i = 0;
  while (i < messageQueue.length && messageQueue[i].timestamp < cutoff) {
    i++;
  }
  if (i > 0) messageQueue.splice(0, i);
}

function isValidType(t: string): t is BusMessage["type"] {
  return t === "command" || t === "query" || t === "response" || t === "broadcast";
}

/**
 * GET — Long-poll for pending messages.
 * Query params:
 *   recipient (required) — agent id or "ramon"
 *   since    (optional) — epoch ms; only return messages after this timestamp
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  pruneExpired();

  const { searchParams } = req.nextUrl;
  const recipient = searchParams.get("recipient");
  const sinceRaw = searchParams.get("since");

  if (!recipient) {
    return NextResponse.json(
      { error: "Missing required query param: recipient" },
      { status: 400 },
    );
  }

  const since = sinceRaw ? parseInt(sinceRaw, 10) : 0;

  const messages = messageQueue.filter((m) => {
    if (m.timestamp <= since) return false;
    return m.to === recipient || m.to === "*";
  });

  return NextResponse.json({
    messages,
    count: messages.length,
    recipient,
    since,
    serverTime: Date.now(),
  });
}

/**
 * POST — Submit a message to the bus.
 * Body: { from, to, type, payload, metadata? }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  pruneExpired();

  let body: IncomingMessage;
  try {
    body = (await req.json()) as IncomingMessage;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { from, to, type, payload, metadata } = body;

  if (!from || !to || !type || !payload) {
    return NextResponse.json(
      { error: "Missing required fields: from, to, type, payload" },
      { status: 400 },
    );
  }

  if (!isValidType(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be: command | query | response | broadcast" },
      { status: 400 },
    );
  }

  const msg: BusMessage = {
    id: randomUUID(),
    from,
    to: type === "broadcast" ? "*" : to,
    type,
    payload,
    metadata: metadata ?? {},
    timestamp: Date.now(),
  };

  messageQueue.push(msg);

  return NextResponse.json({
    ok: true,
    message: msg,
    queueDepth: messageQueue.length,
  });
}
