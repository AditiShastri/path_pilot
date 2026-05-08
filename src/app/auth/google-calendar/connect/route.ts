import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCalendarPermissionUrl } from "@/lib/google/calendarOAuth";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }

  const url = createCalendarPermissionUrl({ userId: user.id });
  return NextResponse.redirect(url);
}
