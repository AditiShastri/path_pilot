import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TelegramProfile {
  id: string;
  email?: string | null;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram_connected?: boolean | null;
}

interface SaveTelegramInput {
  userId: string;
  chatId: string;
  username?: string | null;
  email?: string | null;
}

export async function getTelegramProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<TelegramProfile | null> {
  const { data, error } = await supabase
    .from("path_pilot_users")
    .select("id,email,telegram_chat_id,telegram_username,telegram_connected")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveTelegramChatId(
  supabase: SupabaseClient,
  input: SaveTelegramInput
) {
  const { data, error } = await supabase
    .from("path_pilot_users")
    .upsert(
      {
        id: input.userId,
        email: input.email ?? null,
        telegram_chat_id: input.chatId,
        telegram_username: input.username ?? null,
        telegram_connected: true,
      },
      { onConflict: "id" }
    )
    .select("id,email,telegram_chat_id,telegram_username,telegram_connected")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function clearTelegramChatId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("path_pilot_users")
    .update({
      telegram_chat_id: null,
      telegram_username: null,
      telegram_connected: false,
    })
    .eq("id", userId)
    .select("id,email,telegram_chat_id,telegram_username,telegram_connected")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveTelegramChatIdWithAdmin(input: SaveTelegramInput) {
  return saveTelegramChatId(createAdminClient(), input);
}

export async function getConnectedTelegramChatIds() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("path_pilot_users")
    .select("id,telegram_chat_id")
    .eq("telegram_connected", true)
    .not("telegram_chat_id", "is", null);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => ({
      userId: row.id as string,
      chatId: row.telegram_chat_id as string | null,
    }))
    .filter((row): row is { userId: string; chatId: string } =>
      Boolean(row.chatId)
    );
}
