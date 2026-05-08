import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on server" },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json(
        { error: "audio file is required" },
        { status: 400 },
      );
    }

    const client = new OpenAI({ apiKey });
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-mini-transcribe",
      response_format: "json",
    });

    const text =
      typeof transcription.text === "string" ? transcription.text.trim() : "";

    return NextResponse.json({ text });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to transcribe audio" },
      { status: 500 },
    );
  }
}
