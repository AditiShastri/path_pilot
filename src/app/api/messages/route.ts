import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

// Recursively strip pdf_data from any nested object to avoid storing huge base64 in DB
// function stripPdfData(obj: any): any {
//   if (obj === null || obj === undefined) return obj;
//   if (typeof obj !== 'object') return obj;
//   if (Array.isArray(obj)) return obj.map(stripPdfData);
  
//   const result: any = {};
//   for (const key of Object.keys(obj)) {
//     if (key === 'pdf_data') {
//       result.pdf_data_stripped = true;
//       continue;
//     }
//     result[key] = stripPdfData(obj[key]);
//   }
//   return result;
// }

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();

  const { chat_id, user_parts, assistant_parts, is_first_turn, is_regenerate } = body;

  // Strip pdf_data from assistant parts before saving to DB

  if (is_regenerate) {
    const { data: latestAssistant, error: latestError } = await supabase
      .from("messages")
      .select("id")
      .eq("chat_id", chat_id)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("SUPABASE SELECT ERROR:", latestError);
      return NextResponse.json({ error: latestError }, { status: 500 });
    }

    if (latestAssistant?.id) {
      const { error: updateError } = await supabase
        .from("messages")
        .update({ parts: assistant_parts })
        .eq("id", latestAssistant.id);

      if (updateError) {
        console.error("SUPABASE UPDATE ERROR:", updateError);
        return NextResponse.json({ error: updateError }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }
  }

  const { error } = await supabase.from("messages").insert([
    {
      id: randomUUID(),
      chat_id,
      role: "user",
      parts: user_parts,
    },
    {
      id: randomUUID(),
      chat_id,
      role: "assistant",
      parts: assistant_parts,
    },
  ]);

  if (error) {
    console.error("SUPABASE INSERT ERROR:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
  if (is_first_turn) {
    const userText = user_parts.map((p: any) => p.text).join(" ");
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      temperature: 0.2,
      prompt: `
        Create a concise 3–5 word chat title from the user request below.
        
        Rules:
        - No quotes
        - No punctuation at the end
        - Title case
        - Plain words only
        
        User request: ${userText}
      `,
    });

    await supabase
      .from("chats")
      .update({ title: text.trim() })
      .eq("id", chat_id);
  }

  return NextResponse.json({ ok: true });
}
