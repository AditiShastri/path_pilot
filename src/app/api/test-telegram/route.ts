import { sendTelegramReply } from "@/lib/telegram";

export async function GET() {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return Response.json(
      { success: false, error: "Missing TELEGRAM_CHAT_ID environment variable" },
      { status: 500 }
    );
  }

  await sendTelegramReply(chatId, "Telegram test successful");

  return Response.json({
    success: true,
  });
}
