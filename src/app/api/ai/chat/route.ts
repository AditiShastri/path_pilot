import {
  streamText,
  convertToModelMessages,
  pruneMessages
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { resolveModel } from "@/lib/ai/model-resolver";
import { SYSTEM_PROMPT, VOICE_ASSISTANT_SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { readSqlTool } from "@/lib/tools/readSqlTool";
import { schemaInfoTool } from "@/lib/tools/schemaInfoTool";
import { presentDataTool } from "@/lib/tools/presentDataTool";
import {
  executeWriteSqlTool,
  previewWriteSqlTool,
} from "@/lib/tools/writeSqlTool";
import { commutePlanTool } from "@/lib/tools/commutePlanTool";
import { errorDecoder } from "@/lib/ai/decodeError";
import { getTelegramProfile } from "@/lib/telegram-db";
import { sendTelegramReply } from "@/lib/telegram";
import { getUpcomingCalendarEvents } from "@/lib/google-calendar";
import { tool } from "ai";
import { z } from "zod";
import { buildCommutePlan } from "@/lib/commute-assistant";

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

    const {
      messages,
      mode,
      modelId,
      userApiKey,
      voiceAssistantEnabled,
      currentLocation,
    } = await req.json();

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
        read_sql: readSqlTool,
        schema_info: schemaInfoTool,
        present_data: presentDataTool,
        execute_preview_write_sql: previewWriteSqlTool,
        execute_write_sql: executeWriteSqlTool,
        commute_plan: {
          ...tool({
            description: `
              Plan a commute using real-time traffic data and routing.
              Use this whenever the user asks about going to a place, travel time, best mode,
              conflicts with meetings, creating events, or booking transportation.
              Supports any destination with real routing data via TomTom API.
            `,
            inputSchema: z.object({
              message: z.string().describe("The user's full message"),
              destination: z
                .string()
                .optional()
                .describe("Destination extracted from the user message, if clear"),
              origin: z
                .string()
                .optional()
                .describe("Origin location. Will use current location if available."),
              currentLocation: z
                .object({
                  latitude: z.number(),
                  longitude: z.number(),
                  address: z.string().optional(),
                })
                .optional()
                .describe("User's current location from browser geolocation"),
              requestedStartTime: z
                .string()
                .optional()
                .describe("ISO start time if the user provides a meeting/trip time."),
              action: z
                .enum(["plan", "create_event", "book_cab", "book_auto", "book_metro"])
                .optional()
                .describe("The commute action requested by the user."),
            }),
          }),
          execute: async (toolInput: any) => {
            const plan = await buildCommutePlan({
              ...toolInput,
              currentLocation: currentLocation ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                address: currentLocation.address,
              } : undefined,
            });

            // Send Telegram notification if commute was planned successfully
            if (plan.success && plan.action === 'plan') {
              try {
                const profile = await getTelegramProfile(supabase, user.id);
                const chat_id = profile?.telegram_chat_id;

                if (chat_id) {
                  const telegramMessage = `🚗 Commute Planned!\n\n📍 From: ${plan.origin}\n🏁 To: ${plan.destination}\n⏰ Leave at: ${plan.leaveAt}\n🎯 Arrive by: ${plan.arrivalTarget}\n💰 Best option: ${plan.recommendedMode.mode} (${plan.recommendedMode.cost})\n📏 Distance: ${plan.recommendedMode.distance}\n⏱️ Duration: ${plan.recommendedMode.duration}\n\n${plan.recommendedMode.notes}`;
                  
                  await sendTelegramReply(chat_id, telegramMessage);
                }
              } catch (error) {
                console.error("Failed to send Telegram notification:", error);
              }
            }

            // If planning a commute, add booking offers to the response
            if (plan.success && plan.action === 'plan' && plan.bookingOffers) {
              const bookingText = `\n\n**Booking Options:**\n${plan.bookingOffers.cab ? `🚕 Cab: [Book on Ola](${plan.bookingOffers.cab})` : ''}\n${plan.bookingOffers.auto ? `🚗 Auto: [Book on Uber](${plan.bookingOffers.auto})` : ''}\n${plan.bookingOffers.metro ? `🚇 Metro: [Book Ticket](${plan.bookingOffers.metro})` : ''}\n${plan.bookingOffers.transit ? `🚌 Transit: [Book on RedBus](${plan.bookingOffers.transit})` : ''}\n\nWould you like me to help you book any of these options?`;

              return {
                ...plan,
                message: plan.message + bookingText,
              };
            }

            return plan;
          },
        },
        send_telegram: {
          ...tool({
            description:
              "Send a Telegram message to the currently signed-in user's connected Telegram chat. The chat id is read from Supabase automatically; only provide the message text.",
            inputSchema: z.object({
              text: z.string().describe("The Telegram message text to send."),
            }),
          }),
          execute: async (toolInput: any) => {
            const profile = await getTelegramProfile(supabase, user.id);
            const chat_id = profile?.telegram_chat_id;

            // Make the telegram chat id visible whenever the tool is called.
            console.log("[send_telegram] tool called with chat_id:", chat_id);

            if (!chat_id) {
              throw new Error(
                "Missing telegram chat id. Connect Telegram in Pixie first.",
              );
            }

            return sendTelegramReply(chat_id, toolInput?.text);
          },
        },
        query_calendar: {
          ...tool({
            description:
              "Queries the user's Google Calendar for upcoming events. Use this when the user asks about their calendar, schedule, or upcoming appointments.",
            inputSchema: z.object({
              maxResults: z
                .number()
                .optional()
                .default(10)
                .describe("Maximum number of events to retrieve (default: 10)"),
              timeMin: z
                .string()
                .optional()
                .describe("Start time for events query in ISO format (default: now)"),
              timeMax: z
                .string()
                .optional()
                .describe("End time for events query in ISO format"),
              present: z
                .boolean()
                .optional()
                .describe("If true, the output will be presented to the user directly"),
              title: z
                .string()
                .optional()
                .describe("Short title for the displayed content (used if present is true)"),
              summary: z
                .string()
                .optional()
                .describe("Short speakable summary for the voice assistant (used if present is true)"),
            }),
          }),
          execute: async (toolInput: any) => {
            try {
              const events = await getUpcomingCalendarEvents(supabase, user.id, {
                maxResults: toolInput?.maxResults ?? 10,
                timeMin: toolInput?.timeMin ? new Date(toolInput.timeMin) : undefined,
                timeMax: toolInput?.timeMax ? new Date(toolInput.timeMax) : undefined,
              });

              const result = {
                events,
                count: events.length,
                title: toolInput?.title || "Upcoming Calendar Events",
                summary: toolInput?.summary || `Found ${events.length} upcoming events`,
              };

              if (toolInput?.present) {
                // Format events as markdown for presentation
                const markdown = events.length > 0 
                  ? events.map(event => 
                      `**${event.title}**\n- Location: ${event.location}\n- Time: ${new Date(event.startTime).toLocaleString()}${event.endTime ? ` - ${new Date(event.endTime).toLocaleString()}` : ''}`
                    ).join('\n\n')
                  : 'No upcoming events found.';

                return {
                  title: result.title,
                  summary: result.summary,
                  markdown,
                  _present: true,
                };
              }

              return result;
            } catch (error: any) {
              console.error("Calendar tool error:", error);
              throw new Error(`Failed to query calendar: ${error.message}`);
            }
          },
        },
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
