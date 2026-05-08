import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { env } from "process";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;


  const { data } = await supabase
    .from("chats")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .eq("app", env.APPLICATION)
    .order("updated_at", { ascending: false });

  return NextResponse.json(data ?? []);
}
