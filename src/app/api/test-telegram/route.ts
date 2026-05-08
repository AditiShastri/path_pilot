import { sendTelegramReply } from "@/lib/telegram";
import { getConnectedTelegramChatIds } from "@/lib/telegram-db";

export async function GET() {
  const recipients = await getConnectedTelegramChatIds();

  if (recipients.length === 0) {
    return Response.json(
      {
        success: false,
        error: "No connected Telegram chat ids found in path_pilot_users",
      },
      { status: 500 }
    );
  }

  for (const recipient of recipients) {
    await sendTelegramReply(recipient.chatId, "Telegram test successful");
  }

  return Response.json({
    success: true,
    recipients: recipients.length,
  });
}
