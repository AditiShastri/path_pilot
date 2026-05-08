import { tool } from "ai";
import { z } from "zod";

export const telegramTool = tool({
  description: "Send a Telegram message via the bot.",
  inputSchema: z.object({
    chat_id: z.union([z.number(), z.string()]),
    text: z.string(),
  }),
  execute: async ({ chat_id, text }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
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