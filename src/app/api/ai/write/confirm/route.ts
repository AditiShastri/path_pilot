import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const previewId = body?.preview_id;

    if (!previewId || typeof previewId !== "string") {
      return NextResponse.json(
        { error: "preview_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("execute_write_sql", {
      p_preview_id: previewId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const row = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      ok: true,
      preview_id: previewId,
      operation: row?.operation ?? null,
      table_name: row?.table_name ?? null,
      affected_rows: row?.affected_rows ?? 0,
      committed_at: row?.committed_at ?? null,
      summary: row?.summary ?? "Write operation committed successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to execute write commit" },
      { status: 500 }
    );
  }
}
