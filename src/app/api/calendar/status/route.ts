import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  disconnectCalendarConnection,
  getCalendarConnection,
} from "@/lib/google-calendar";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const connection = await getCalendarConnection(supabase, user.id);

  return NextResponse.json({
    connected: Boolean(connection?.connected && connection?.refresh_token),
    expiryDate: connection?.expiry_date ?? null,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await disconnectCalendarConnection(supabase, user.id);

  return NextResponse.json({
    connected: false,
  });
}
