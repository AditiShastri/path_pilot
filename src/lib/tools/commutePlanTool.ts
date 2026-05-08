import { tool } from "ai";
import { z } from "zod";
import { buildCommutePlan } from "@/lib/commute-assistant";
import { createClient } from "@supabase/supabase-js";
import { getTelegramProfile } from "@/lib/telegram-db";
import { sendTelegramReply } from "@/lib/telegram";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const commutePlanTool = tool({
  description: `
    Plan a mock commute using the Smart Calendar Commute Assistant data.
    Use this whenever the user asks about going to a place, travel time, best mode,
    conflicts with meetings, creating a mock event, or mock booking a cab, auto, or metro.
    Known mock destinations include MG Road Bangalore and Electronic City Bangalore.
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
      .describe("Origin location. Defaults to Whitefield Bangalore or current location if available."),
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
  execute: async (input) => buildCommutePlan(input),
});
