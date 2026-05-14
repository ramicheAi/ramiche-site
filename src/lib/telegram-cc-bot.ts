/**
 * Telegram Bot API helpers for CC synthesis Approve & dispatch from Telegram.
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN — required for editMessageReplyMarkup / answerCallbackQuery
 *   TELEGRAM_WEBHOOK_SECRET — optional; set via setWebhook secret_token, sent as
 *     header X-Telegram-Bot-Api-Secret-Token on each update
 */

function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[\s\x00-\x1f\x7f]+$/u, "").replace(/^\s+/u, "");
  return cleaned || undefined;
}

function botToken(): string | null {
  return cleanEnv("TELEGRAM_BOT_TOKEN") || null;
}

async function tgApi(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; description?: string }> {
  const token = botToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN not set" };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  try {
    return (await res.json()) as { ok: boolean; description?: string };
  } catch {
    return { ok: false, description: "invalid JSON from Telegram" };
  }
}

/** Max callback_data length is 64 bytes; cc_appr: + uuid fits. */
export const TG_CB_APPROVE_PREFIX = "cc_appr:";

export function telegramCallbackDataForApprove(synthesisMessageId: string): string {
  return `${TG_CB_APPROVE_PREFIX}${synthesisMessageId}`;
}

/** Attach inline [Approve & dispatch] under an existing bot message. */
export async function telegramAttachApproveButton(
  chatId: number | string,
  messageId: number,
  synthesisSupabaseId: string
): Promise<{ ok: boolean; error?: string }> {
  const callbackData = telegramCallbackDataForApprove(synthesisSupabaseId);
  if (callbackData.length > 64) {
    return { ok: false, error: "callback_data exceeds Telegram 64-byte limit" };
  }
  const result = await tgApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: "✓ Approve & dispatch", callback_data: callbackData }],
      ],
    },
  });
  if (!result.ok) {
    return { ok: false, error: result.description || "Telegram API error" };
  }
  return { ok: true };
}

export async function telegramAnswerCallbackQuery(
  callbackQueryId: string,
  text: string,
  showAlert?: boolean
): Promise<void> {
  await tgApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text.slice(0, 200),
    show_alert: !!showAlert,
  });
}

export function verifyTelegramWebhookSecret(req: { headers: Headers }): boolean {
  const expected = cleanEnv("TELEGRAM_WEBHOOK_SECRET");
  if (!expected) return true;
  return req.headers.get("X-Telegram-Bot-Api-Secret-Token") === expected;
}
