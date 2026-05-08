import { tool } from "ai";
import { z } from "zod";
import { getTelegramLink } from "@/lib/telegramStore";

export const telegramTool = tool({
  description: "Send a Telegram message to a connected Telegram chat. You must provide the user_id of the user whose Telegram chat you want to message.",
  inputSchema: z.object({
    user_id: z.string().describe("The user ID whose Telegram chat to send the message to"),
    text: z.string().describe("The Telegram message text to send."),
  }),
  execute: async ({ user_id, text }) => {
    const linkRecord = getTelegramLink(user_id);
    if (!linkRecord) {
      throw new Error("No Telegram chat connected for this user");
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: linkRecord.chatId,
          text,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Telegram error: ${res.status}`);
    }

    return await res.json();
  },
});