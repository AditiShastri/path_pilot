import { NextResponse } from "next/server";
import { consumeTelegramToken } from "@/lib/telegramStore";
import { saveTelegramChatIdWithAdmin } from "@/lib/telegram-db";

import { sendTelegramReply } from "@/lib/telegram";

const BOT_USERNAME = "namma_path_pilot_bot";

export async function POST(req: Request) {
  try {
    const update = await req.json();

    const rawChatId = update.message?.chat?.id;
    const chatId = rawChatId ? String(rawChatId) : null;
    const message = update.message?.text?.trim();
    const telegramUsername =
      update.message?.chat?.username ??
      update.message?.from?.username ??
      null;

    if (!message || !chatId) {
      return NextResponse.json({ ok: true });
    }

    if (message.startsWith("/start")) {
      const parts = message.split(/\s+/);
      const token = parts[1];

      if (!token) {
        await sendTelegramReply(
          chatId,
          `Welcome to ${BOT_USERNAME}! To connect your Telegram account, generate a link from the web app and use it with this bot.`,
        );
        return NextResponse.json({ ok: true });
      }

      const linkRecord = consumeTelegramToken(token);
      if (!linkRecord) {
        await sendTelegramReply(
          chatId,
          "This Telegram connection link is invalid or expired. Please generate a new link from Pixie.",
        );
        return NextResponse.json({ ok: true });
      }

      await saveTelegramChatIdWithAdmin({
        userId: linkRecord.userId,
        email: linkRecord.email,
        chatId,
        username: telegramUsername,
      });

      await sendTelegramReply(
        chatId,
        "Success! Telegram is connected to Pixie.",
      );
      return NextResponse.json({ ok: true });
    }



    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/ai/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", parts: [{ type: "text", text: message }] }],
          mode: "server-key",
          modelId: "google/gemini-2.5-flash",
          voiceAssistantEnabled: false,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      await sendTelegramReply(chatId, `AI request failed: ${errorText}`);
      return NextResponse.json({ ok: true });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      await sendTelegramReply(chatId, "No response body received from AI.");
      return NextResponse.json({ ok: true });
    }

    let aiText = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith("0:")) {
          try {
            const data = JSON.parse(line.substring(2));
            if (data.text) {
              aiText += data.text;
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }

    if (!aiText.trim()) {
      aiText = "I could not generate a response. Please try again.";
    }

    await sendTelegramReply(chatId, aiText.slice(0, 4096));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 200 } // Return 200 to prevent Telegram from retrying
    );
  }
}
