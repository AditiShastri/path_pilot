import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { getUpcomingEvents, CalendarNotConnectedError } from "@/lib/calendar/calendarService";
import { generateCommuteAdvice } from "@/lib/ai/commuteAdvice";
import { debugLog } from "@/lib/debug/serverDebug";
import { randomUUID } from "crypto";

export function createCalendarTools(options: { userId: string; baseUrl: string }) {
  const connectUrl = new URL("/auth/google-calendar/connect", options.baseUrl).toString();

  const upcomingEvents = tool({
    description:
      "Fetch upcoming Google Calendar events for the next 24 hours for the authenticated user. Ignores cancelled events and events without a location.",
    inputSchema: z.object({}),
    execute: async () => {
      const traceId = randomUUID();
      debugLog("Tool upcoming_events invoked", { traceId, userId: options.userId });
      try {
        const events = await getUpcomingEvents(options.userId, { traceId });
        debugLog("Tool upcoming_events result", { traceId, userId: options.userId, events: events.length });
        return { connected: true, events };
      } catch (e) {
        if (e instanceof CalendarNotConnectedError) {
          debugLog("Tool upcoming_events not connected", { traceId, userId: options.userId });
          return {
            connected: false,
            connectUrl,
            events: [],
            message: "Calendar is not connected. User must grant permission.",
          };
        }
        throw e;
      }
    },
  });

  const commuteAdviceForNextEvent = tool({
    description:
      "Generate AI commute advice for the next upcoming event (within 24h) that has a location. Requires Google Calendar to be connected.",
    inputSchema: z.object({
      preferEventId: z.string().optional().describe("Optional: specific event id to generate advice for"),
    }),
    execute: async (input) => {
      const traceId = randomUUID();
      debugLog("Tool commute_advice_next_event invoked", {
        traceId,
        userId: options.userId,
        preferEventId: input.preferEventId ?? null,
      });

      let events: Awaited<ReturnType<typeof getUpcomingEvents>>;
      try {
        events = await getUpcomingEvents(options.userId, { traceId });
      } catch (e) {
        if (e instanceof CalendarNotConnectedError) {
          debugLog("Tool commute_advice_next_event not connected", { traceId, userId: options.userId });
          return {
            connected: false,
            connectUrl,
            foundEvent: false,
            message: "Calendar is not connected. User must grant permission.",
          };
        }
        throw e;
      }
      const event = input.preferEventId
        ? events.find((e) => e.id === input.preferEventId) ?? events[0]
        : events[0];

      if (!event) {
        debugLog("Tool commute_advice_next_event no event found", { traceId, userId: options.userId });
        return {
          connected: true,
          foundEvent: false,
          message: "No upcoming events with locations in the next 24 hours.",
        };
      }

      const advice = await generateCommuteAdvice(event);
      debugLog("Tool commute_advice_next_event ok", { traceId, userId: options.userId, eventId: event.id });
      return { connected: true, foundEvent: true, event, advice };
    },
  });

  return {
    upcoming_events: upcomingEvents,
    commute_advice_next_event: commuteAdviceForNextEvent,
  };
}
