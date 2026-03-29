import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { fsUrl } from "@/lib/bridge-handlers";

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
const MAX_STORED = 300;
const COMMS_DOC = "command-center/commsMessages";

/** In-memory fallback (local dev or missing Firestore key). */
const messageQueue: BusMessage[] = [];

const commsPersistEnabled = () => Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

function pruneExpired(msgs: BusMessage[]): BusMessage[] {
  const cutoff = Date.now() - MESSAGE_TTL_MS;
  return msgs.filter((m) => m.timestamp >= cutoff).slice(-MAX_STORED);
}

function pruneExpiredMemory(): void {
  const cutoff = Date.now() - MESSAGE_TTL_MS;
  let i = 0;
  while (i < messageQueue.length && messageQueue[i].timestamp < cutoff) {
    i++;
  }
  if (i > 0) messageQueue.splice(0, i);
}

async function loadFromFirestore(): Promise<BusMessage[]> {
  const res = await fetch(fsUrl(COMMS_DOC), { cache: "no-store" });
  if (!res.ok) return [];
  const doc = (await res.json()) as {
    fields?: { messagesJson?: { stringValue?: string } };
  };
  const j = doc.fields?.messagesJson?.stringValue;
  if (!j) return [];
  try {
    const parsed = JSON.parse(j) as BusMessage[];
    return Array.isArray(parsed) ? pruneExpired(parsed) : [];
  } catch {
    return [];
  }
}

async function saveToFirestore(msgs: BusMessage[]): Promise<void> {
  const pruned = pruneExpired(msgs);
  const body = {
    fields: {
      messagesJson: { stringValue: JSON.stringify(pruned) },
    },
  };
  const url = `${fsUrl(COMMS_DOC)}?updateMask.fieldPaths=messagesJson`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Firestore save failed: ${res.status}`);
  }
}

async function getAllMessages(): Promise<BusMessage[]> {
  pruneExpiredMemory();
  if (commsPersistEnabled()) {
    try {
      const remote = await loadFromFirestore();
      return remote;
    } catch {
      return pruneExpired([...messageQueue]);
    }
  }
  return pruneExpired([...messageQueue]);
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

  const all = await getAllMessages();
  const messages = all.filter((m) => {
    if (m.timestamp <= since) return false;
    return m.to === recipient || m.to === "*";
  });

  return NextResponse.json({
    messages,
    count: messages.length,
    recipient,
    since,
    serverTime: Date.now(),
    persisted: commsPersistEnabled(),
  });
}

/**
 * POST — Submit a message to the bus.
 * Body: { from, to, type, payload, metadata? }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
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

  if (commsPersistEnabled()) {
    try {
      const all = await loadFromFirestore();
      all.push(msg);
      await saveToFirestore(all);
    } catch {
      messageQueue.push(msg);
      pruneExpiredMemory();
    }
  } else {
    messageQueue.push(msg);
    pruneExpiredMemory();
  }

  return NextResponse.json({
    ok: true,
    message: msg,
    queueDepth: commsPersistEnabled() ? undefined : messageQueue.length,
  });
}
