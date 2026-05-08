import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  clearTelegramChatId,
  getTelegramProfile,
  saveTelegramChatId,
} from "@/lib/telegram-db";
import {
  saveTelegramToken,
  getPendingTelegramToken,
} from "@/lib/telegramStore";

const BOT_USERNAME = "namma_path_pilot_bot";
const TOKEN_LIFETIME_MS = 1000 * 60 * 60; // 1 hour

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const profile = await getTelegramProfile(supabase, user.id);
    const pendingToken = getPendingTelegramToken(user.id);

    const connected = Boolean(
      profile?.telegram_connected && profile?.telegram_chat_id
    );
    const link = pendingToken
      ? `https://t.me/${BOT_USERNAME}?start=${pendingToken}`
      : undefined;

    return NextResponse.json({
      connected,
      chatId: profile?.telegram_chat_id ?? null,
      username: profile?.telegram_username ?? null,
      link,
    });
  } catch (error: any) {
    console.error("Telegram link status failed:", error);
    return NextResponse.json(
      {
        error: error?.message ?? "Could not load Telegram connection status",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const chatId = typeof body?.chatId === "string" ? body.chatId.trim() : "";
    const username =
      typeof body?.username === "string" ? body.username.trim() : null;

    if (chatId) {
      const profile = await saveTelegramChatId(supabase, {
        userId: user.id,
        email: user.email,
        chatId,
        username,
      });

      return NextResponse.json({
        connected: Boolean(profile.telegram_chat_id),
        chatId: profile.telegram_chat_id,
        username: profile.telegram_username,
      });
    }

    const token = randomUUID();
    const tokenExpiresAt = Date.now() + TOKEN_LIFETIME_MS;
    saveTelegramToken(user.id, token, tokenExpiresAt, user.email);

    return NextResponse.json({
      token,
      deepLink: `https://t.me/${BOT_USERNAME}?start=${token}`,
      expiresAt: tokenExpiresAt,
    });
  } catch (error: any) {
    console.error("Telegram link create failed:", error);
    return NextResponse.json(
      {
        error: error?.message ?? "Could not generate Telegram connect link",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const profile = await clearTelegramChatId(supabase, user.id);

    return NextResponse.json({
      connected: false,
      chatId: profile.telegram_chat_id,
      username: profile.telegram_username,
    });
  } catch (error: any) {
    console.error("Telegram disconnect failed:", error);
    return NextResponse.json(
      {
        error: error?.message ?? "Could not disconnect Telegram",
      },
      { status: 500 }
    );
  }
}
