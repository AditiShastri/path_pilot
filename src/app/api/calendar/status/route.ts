import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error: dbError } = await admin
    .from("path_pilot_calendar_connections")
    .select("connected")
    .eq("user_id", user.id)
    .maybeSingle();

  if (dbError) {
    return NextResponse.json(
      { connected: false, error: dbError.message },
      { status: 500 }
    );
  }

  const connected = Boolean(data?.connected);
  const connectUrl = new URL("/auth/google-calendar/connect", request.url).toString();

  return NextResponse.json({ connected, connectUrl });
}
