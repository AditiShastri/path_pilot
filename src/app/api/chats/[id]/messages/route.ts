import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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
    .from("messages")
    .select("*")
    .eq("chat_id", id)
    .order("created_at", { ascending: true })
    .order("role", { ascending: false });

  return NextResponse.json(data ?? []);
}


  