import {
  streamText,
  convertToModelMessages,
  pruneMessages
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { resolveModel } from "@/lib/ai/model-resolver";
import { SYSTEM_PROMPT, VOICE_ASSISTANT_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { presentDataTool } from "@/lib/tools/presentDataTool";
import { createCalendarTools } from "@/lib/tools/calendarTools";
import { errorDecoder } from "@/lib/ai/decodeError";
import { createAdminClient } from "@/lib/supabase/admin";

type LocationSource = "home" | "current" | "manual";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCoords(input: any): { lat: number; lng: number } | null {
  const lat = input?.lat;
  const lng = input?.lng;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function POST(req: Request) {
  try{
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  const { messages, mode, modelId, userApiKey, voiceAssistantEnabled, location } = await req.json();

  // Resolve optional location context (home/current/manual) for travel planning.
  const requestedSource: LocationSource | null =
    location?.source === "home" || location?.source === "current" || location?.source === "manual"
      ? location.source
      : null;

  let resolvedCoords: { lat: number; lng: number } | null = null;
  if (requestedSource === "home") {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("path_pilot_users")
        .select("home_lat, home_lng")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.home_lat != null && data?.home_lng != null) {
        resolvedCoords = { lat: data.home_lat, lng: data.home_lng };
      }
    } catch {
      resolvedCoords = null;
    }
  } else if (requestedSource === "current" || requestedSource === "manual") {
    resolvedCoords = normalizeCoords(location?.coords);
  }

  const baseSystem = voiceAssistantEnabled ? VOICE_ASSISTANT_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const system = resolvedCoords
    ? `${baseSystem}\n\n# User Location Context\n- Preferred origin source: ${requestedSource}\n- Preferred origin coordinates: ${resolvedCoords.lat.toFixed(6)}, ${resolvedCoords.lng.toFixed(6)}\nUse this as the default origin when the user asks for commute/travel planning and does not specify an origin.`
    : baseSystem;

  const calendarTools = createCalendarTools({ userId: user.id, baseUrl: req.url });

  const model = resolveModel({ mode, model: modelId, userApiKey });
  
  const modelMessages = (await convertToModelMessages(messages)).slice(-12);
  const prunedMessages = pruneMessages({
    messages:modelMessages,
    toolCalls: 'before-last-2-messages',
    emptyMessages: 'remove',
  });
  //console.log(JSON.stringify(prunedMessages, null, 2));
    const result = streamText({
      model,
      system,
      messages: prunedMessages,
      tools: { 
        present_data: presentDataTool,
        ...calendarTools,
      },
      toolChoice: "auto",
      // Stop after 10 steps
      stopWhen: (context) => {
        return context.steps.length >= 10;
      },
      onError(error) {
        const decoded = errorDecoder(error);
        console.log("This is on stream error: ",decoded);
      
      },  
    });
    return result.toUIMessageStreamResponse({
      messageMetadata({ part }) {
    if (part.type === "finish") {
      return {
        usage: part.totalUsage
      };
    }
  },
      onError(error) {
        const decoded = errorDecoder(error);
        return decoded  // ✅ becomes useChat onError
      } 
    });
    
  }catch (err: any) {
    // ONLY pre-stream errors reach here
    const decoded = errorDecoder(err);
    console.log("This is catch error ",decoded)
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(decoded);
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
        },
        status: 500,
      }
    );
  }
}
