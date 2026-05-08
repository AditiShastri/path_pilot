import {
  streamText,
  convertToModelMessages,
  pruneMessages
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { resolveModel } from "@/lib/ai/model-resolver";
import { SYSTEM_PROMPT, VOICE_ASSISTANT_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { presentDataTool } from "@/lib/tools/presentDataTool";
import { errorDecoder } from "@/lib/ai/decodeError";

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
  const { messages, mode, modelId, userApiKey, voiceAssistantEnabled } = await req.json();

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
      system: voiceAssistantEnabled ? VOICE_ASSISTANT_SYSTEM_PROMPT : SYSTEM_PROMPT,
      messages: prunedMessages,
      tools: { 
        present_data: presentDataTool,
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
