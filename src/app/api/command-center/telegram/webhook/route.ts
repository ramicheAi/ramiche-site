/**
 * Telegram Bot API updates webhook.
 *
 * P03 posture:
 *   - Webhook secret REQUIRED (fail closed). This authenticates the transport,
 *     not a human.
 *   - Consequential dispatch (synthesis approve → execute) is DENIED because no
 *     verified Telegram→canonical-human binding exists. Callback payload
 *     labels (from.id, chat.id, username) are untrusted input, not identity.
 *   - Denial performs NO side effects, including no Telegram API calls.
 *
 * Re-enabling dispatch requires a separately established, verified binding and
 * its own Ramon approval — not an env flag.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  requireTelegramTransport,
  telegramConsequentialDispatchDecision,
} from "@/lib/server/telegram-dispatch-policy";
import { TG_CB_APPROVE_PREFIX } from "@/lib/telegram-cc-bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type TelegramUpdate = {
  callback_query?: { id?: string; data?: string };
};

export async function POST(req: NextRequest) {
  const transport = requireTelegramTransport(req);
  if (!transport.ok) {
    return NextResponse.json(
      { ok: false, error: "denied", reason: transport.reason },
      { status: transport.status }
    );
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!update || typeof update !== "object" || Array.isArray(update)) {
    return NextResponse.json({ ok: false, error: "invalid update" }, { status: 400 });
  }
  const data = update.callback_query?.data;
  if (typeof data === "string" && data.startsWith(TG_CB_APPROVE_PREFIX)) {
    const decision = telegramConsequentialDispatchDecision(update);
    return NextResponse.json(
      {
        ok: false,
        error: "denied",
        reason: decision.reason,
        note: "Approve from the authenticated cockpit. Telegram is not an identity source.",
      },
      { status: decision.status }
    );
  }

  // Non-consequential updates are acknowledged without action.
  return NextResponse.json({ ok: true, dispatched: false });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST Telegram updates here. TELEGRAM_WEBHOOK_SECRET is required (fail closed).",
    dispatch: "disabled_no_verified_human_binding",
    callback_prefix: TG_CB_APPROVE_PREFIX,
  });
}
