import { NextResponse } from "next/server";
import { saveTelegramChatId } from "@/lib/telegramStore";

import { sendTelegramReply } from "@/lib/telegram";

const BOT_USERNAME = "namma_path_pilot_bot";

export async function POST(req: Request) {
  try {
    const update = await req.json();

    // NOTE: We still use the in-memory telegramStore for /start <token> linking.
    // For sending AI replies, chatId is already known from the update.


    const rawChatId = update.message?.chat?.id;
    const chatId = rawChatId ? String(rawChatId) : null;
    const message = update.message?.text?.trim();

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

      // No DB/in-memory token consumption for now.
      // Treat `start` payload as the Telegram chat id directly.
      // token may be chat id (or you can later encode/decode other info).
      const chatIdToSave = String(token);
      saveTelegramChatId("local", chatIdToSave);

      // Confirm using the real incoming chat id.
      await sendTelegramReply(
        chatId,
        "Success! Telegram chat id linked (local mode).",
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