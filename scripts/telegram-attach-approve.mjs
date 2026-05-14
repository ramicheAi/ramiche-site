#!/usr/bin/env node
/**
 * Attach [Approve & dispatch] inline button to an existing Telegram bot message.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... node scripts/telegram-attach-approve.mjs <chatId> <messageId> <synthesisSupabaseUuid>
 *
 * Use when OpenClaw inserted the synthesis into Supabase separately and you
 * need to retrofit the button onto the Telegram message.
 */

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const chatId = process.argv[2];
const messageId = process.argv[3];
const synthesisUuid = process.argv[4];

if (!token || !chatId || !messageId || !synthesisUuid) {
  console.error(
    "Usage: TELEGRAM_BOT_TOKEN=... node scripts/telegram-attach-approve.mjs <chatId> <messageId> <synthesisSupabaseUuid>"
  );
  process.exit(1);
}

const callbackData = `cc_appr:${synthesisUuid}`;
if (callbackData.length > 64) {
  console.error("callback_data exceeds Telegram 64-byte limit");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: Number(chatId),
    message_id: Number(messageId),
    reply_markup: {
      inline_keyboard: [[{ text: "✓ Approve & dispatch", callback_data: callbackData }]],
    },
  }),
});

const json = await res.json();
if (!json.ok) {
  console.error(json);
  process.exit(1);
}
console.log("OK", json);
