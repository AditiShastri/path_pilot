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
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voiceId =
      typeof body?.voiceId === "string" && body.voiceId.trim().length > 0
        ? body.voiceId.trim()
        : "EXAVITQu4vr4xnSDxMaL";
    const modelId =
      typeof body?.modelId === "string" && body.modelId.trim().length > 0
        ? body.modelId.trim()
        : "eleven_turbo_v2_5";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const apiKey =
      process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing ELEVENLABS_API_KEY on server" },
        { status: 500 },
      );
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!upstream.ok) {
      let details = "";
      try {
        details = await upstream.text();
      } catch {
        // Ignore upstream read errors.
      }

      return NextResponse.json(
        {
          error: details
            ? `ElevenLabs request failed (${upstream.status}): ${details}`
            : `ElevenLabs request failed (${upstream.status})`,
        },
        { status: upstream.status },
      );
    }

    const audioBuffer = await upstream.arrayBuffer();
    if (!audioBuffer.byteLength) {
      return NextResponse.json(
        { error: "ElevenLabs returned empty audio" },
        { status: 502 },
      );
    }

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to stream ElevenLabs audio" },
      { status: 500 },
    );
  }
}
