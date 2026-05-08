import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createGoogleCalendarOAuthClient,
  saveCalendarConnection,
} from "@/lib/google-calendar";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_calendar_oauth_state")?.value;

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/ai-assistant?calendar=invalid_state", request.url)
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(
      new URL("/login?error=calendar_auth_required", request.url)
    );
  }

  try {
    const oauth2Client = createGoogleCalendarOAuthClient(request.url);
    const { tokens } = await oauth2Client.getToken(code);

    await saveCalendarConnection(supabase, {
      userId: user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });

    cookieStore.delete("google_calendar_oauth_state");

    return NextResponse.redirect(
      new URL("/ai-assistant?calendar=connected", request.url)
    );
  } catch (calendarError) {
    console.error("Google Calendar callback failed:", calendarError);
    return NextResponse.redirect(
      new URL("/ai-assistant?calendar=failed", request.url)
    );
  }
}
