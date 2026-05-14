import { NextRequest, NextResponse } from "next/server";
import { approveSynthesisMessage } from "@/lib/cc-approve-synthesis";
import {
  telegramAnswerCallbackQuery,
  verifyTelegramWebhookSecret,
  TG_CB_APPROVE_PREFIX,
} from "@/lib/telegram-cc-bot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type TgCallbackQuery = {
  id: string;
  data?: string;
  message?: { chat?: { id?: number }; message_id?: number };
};

type TelegramUpdate = {
  callback_query?: TgCallbackQuery;
};

function tgMarkupDone(label: string) {
  return {
    inline_keyboard: [[{ text: label.slice(0, 64), callback_data: "cc_done" }]],
  };
}

async function editMarkupDone(
  chatId: number | string,
  messageId: number,
  dispatched: number,
  total: number
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: tgMarkupDone(`✓ Dispatched ${dispatched}/${total}`),
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {});
}

/** Telegram Bot API updates webhook — handles inline Approve for synthesis rows. */
export async function POST(req: NextRequest) {
  if (!verifyTelegramWebhookSecret(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cq = update.callback_query;
  if (!cq?.data || !cq.id) {
    return NextResponse.json({ ok: true });
  }

  const cqMsg = cq.message;
  const chatId = cqMsg?.chat?.id;
  const msgId = cqMsg?.message_id;

  if (chatId == null || msgId == null) {
    await telegramAnswerCallbackQuery(cq.id, "Missing chat/message.", false);
    return NextResponse.json({ ok: true });
  }

  const data = cq.data;

  if (data === "cc_done") {
    await telegramAnswerCallbackQuery(cq.id, "Already dispatched.");
    return NextResponse.json({ ok: true });
  }

  if (!data.startsWith(TG_CB_APPROVE_PREFIX)) {
    return NextResponse.json({ ok: true });
  }

  const synthesisId = data.slice(TG_CB_APPROVE_PREFIX.length);
  if (!/^[0-9a-f-]{36}$/i.test(synthesisId)) {
    await telegramAnswerCallbackQuery(cq.id, "Invalid synthesis id.", true);
    return NextResponse.json({ ok: true });
  }

  const result = await approveSynthesisMessage(synthesisId);

  if (!result.ok) {
    await telegramAnswerCallbackQuery(cq.id, result.error.slice(0, 180), true);
    return NextResponse.json({ ok: true });
  }

  if (result.alreadyApproved) {
    await telegramAnswerCallbackQuery(cq.id, "Already approved.");
    await editMarkupDone(chatId, msgId, 0, result.total ?? 0);
    return NextResponse.json({ ok: true });
  }

  const d = result.dispatched ?? 0;
  const t = result.total ?? 0;
  await telegramAnswerCallbackQuery(cq.id, `Dispatched ${d}/${t} handoffs.`);
  await editMarkupDone(chatId, msgId, d, Math.max(t, 1));

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST Telegram updates here. setWebhook(..., { url, secret_token }) must match TELEGRAM_WEBHOOK_SECRET (sent as X-Telegram-Bot-Api-Secret-Token).",
    callback_prefix: TG_CB_APPROVE_PREFIX,
  });
}
