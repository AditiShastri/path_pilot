import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  saveTelegramToken,
  getPendingTelegramToken,
  getTelegramLink,
} from "@/lib/telegramStore";

const BOT_USERNAME = "namma_path_pilot_ot";
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

    const linkRecord = getTelegramLink(user.id);
    const pendingToken = getPendingTelegramToken(user.id);

    const connected = Boolean(linkRecord?.chatId);
    const link = pendingToken
      ? `https://t.me/${BOT_USERNAME}?start=${pendingToken}`
      : undefined;

    return NextResponse.json({
      connected,
      chatId: linkRecord?.chatId ?? null,
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

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = randomUUID();
    const tokenExpiresAt = Date.now() + TOKEN_LIFETIME_MS;
    saveTelegramToken(user.id, token, tokenExpiresAt);

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
