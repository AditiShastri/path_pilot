import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingCalendarEvents } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const maxResults = Number(searchParams.get("maxResults") ?? 10);
    const events = await getUpcomingCalendarEvents(supabase, user.id, {
      requestUrl: request.url,
      maxResults,
    });

    return NextResponse.json({
      connected: true,
      events,
    });
  } catch (calendarError: any) {
    return NextResponse.json(
      {
        connected: false,
        error: calendarError?.message ?? "Could not load calendar events",
      },
      { status: 400 }
    );
  }
}
