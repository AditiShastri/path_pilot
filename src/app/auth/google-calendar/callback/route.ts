import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  verifySignedState,
} from "@/lib/google/calendarOAuth";
import { debugLog } from "@/lib/debug/serverDebug";

function toExpiryDate(expiresInSeconds?: number) {
  if (!expiresInSeconds) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/ai-assistant?calendar=error", request.url));
  }

  let stateUserId: string;
  try {
    stateUserId = verifySignedState(state).userId;
  } catch {
    return NextResponse.redirect(new URL("/ai-assistant?calendar=error", request.url));
  }

  // If Supabase cookies are present, ensure the callback is for the same logged-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? stateUserId;
  if (user?.id && user.id !== stateUserId) {
    return NextResponse.redirect(new URL("/ai-assistant?calendar=error", request.url));
  }

  try {
    debugLog("Calendar OAuth callback start", {
      userId,
      hasSupabaseUser: Boolean(user?.id),
    });

    const tokens = await exchangeCodeForTokens(code);

    debugLog("Calendar OAuth code exchanged", {
      userId,
      hasRefreshToken: Boolean(tokens.refresh_token),
      expires_in: tokens.expires_in ?? null,
      scope: tokens.scope ?? null,
      token_type: tokens.token_type ?? null,
    });

    const admin = createAdminClient();

    // Defensive: ensure `path_pilot_users` exists so the FK in connections won't fail.
    // Email is nullable, so we can upsert the id even if we don't have it.
    await admin.from("path_pilot_users").upsert(
      {
        id: userId,
        email: user?.email ?? null,
      },
      { onConflict: "id" }
    );

    // Keep existing refresh_token if Google doesn't return one (common when already granted).
    const { data: existing } = await admin
      .from("path_pilot_calendar_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    const refresh_token = tokens.refresh_token ?? existing?.refresh_token;

    debugLog("Calendar refresh token resolved", {
      userId,
      gotNewRefreshToken: Boolean(tokens.refresh_token),
      hadExistingRefreshToken: Boolean(existing?.refresh_token),
      finalHasRefreshToken: Boolean(refresh_token),
    });

    if (!refresh_token) {
      return NextResponse.redirect(new URL("/ai-assistant?calendar=needs_reconnect", request.url));
    }

    const { error: upsertError } = await admin
      .from("path_pilot_calendar_connections")
      .upsert(
        {
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token,
          expiry_date: toExpiryDate(tokens.expires_in),
          connected: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Calendar token upsert error:", upsertError);
      return NextResponse.redirect(new URL("/ai-assistant?calendar=error", request.url));
    }

    debugLog("Calendar connection upserted", {
      userId,
      expiry_date: toExpiryDate(tokens.expires_in),
      connected: true,
    });

    return NextResponse.redirect(new URL("/ai-assistant?calendar=connected", request.url));
  } catch (e) {
    console.error("Calendar OAuth callback error:", e);
    return NextResponse.redirect(new URL("/ai-assistant?calendar=error", request.url));
  }
}
