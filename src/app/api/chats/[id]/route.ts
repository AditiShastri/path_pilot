import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { env } from "process";
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
  
  const { data, error } = await supabase
    .from("chats")
    .select("id, model_id, mode")
    .eq("id", id)
    .eq("app", env.APPLICATION)
    .eq("user_id", userId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
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

    await supabase.from("chats").delete().eq("id", id).eq("user_id", userId).eq("app", env.APPLICATION);
  
    return NextResponse.json({ ok: true });
  }
  
  
  export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
  ) {
    const { id } = await context.params;
    const { title } = await req.json();
    
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    await supabase.from("chats").update({ title }).eq("id", id).eq("user_id", userId).eq("app", env.APPLICATION);
  
    return NextResponse.json({ ok: true });
  }
