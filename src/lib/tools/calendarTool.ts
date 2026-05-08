import { tool } from "ai";
import { z } from "zod";
import { getUpcomingCalendarEvents } from "@/lib/google-calendar";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const calendarTool = tool({
  description: `
    Queries the user's Google Calendar for upcoming events.
    
    Use this tool when the user asks about their calendar events, schedule, or upcoming appointments.
    The tool retrieves events from the connected Google Calendar.
    `,

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

  execute: async ({ maxResults, timeMin, timeMax, present, title, summary }) => {
    try {
      // Get user ID from context - this would need to be passed from the request context
      // For now, we'll assume it's available or throw an error
      const userId = "current_user_id"; // This needs to be properly handled

      const events = await getUpcomingCalendarEvents(supabase, userId, {
        maxResults,
        timeMin: timeMin ? new Date(timeMin) : undefined,
        timeMax: timeMax ? new Date(timeMax) : undefined,
      });

      const result = {
        events,
        count: events.length,
        title: title || "Upcoming Calendar Events",
        summary: summary || `Found ${events.length} upcoming events`,
      };

      if (present) {
        return {
          ...result,
          _present: true,
        };
      }

      return result;
    } catch (error) {
      console.error("Calendar tool error:", error);
      throw new Error(`Failed to query calendar: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});