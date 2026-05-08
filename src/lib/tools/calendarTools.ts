import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { getUpcomingEvents, createCalendarEvent, CalendarNotConnectedError } from "@/lib/calendar/calendarService";
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

  const createCalendarEventTool = tool({
    description:
      "Create a Google Calendar event for the authenticated user (primary calendar). Requires Google Calendar to be connected with write permissions.",
    inputSchema: z.object({
      title: z.string().min(1).describe("Event title/summary"),
      startTime: z
        .string()
        .min(1)
        .describe("Event start time in RFC3339, e.g. 2026-05-08T15:00:00-04:00"),
      endTime: z
        .string()
        .min(1)
        .describe("Event end time in RFC3339, e.g. 2026-05-08T16:00:00-04:00"),
      timeZone: z
        .string()
        .optional()
        .describe("Optional IANA timezone, e.g. America/New_York"),
      location: z.string().optional().describe("Optional event location"),
      description: z.string().optional().describe("Optional event description/notes"),
      attendees: z
        .array(z.string().min(3))
        .optional()
        .describe("Optional list of attendee emails"),
    }),
    execute: async (input) => {
      const traceId = randomUUID();
      debugLog("Tool create_calendar_event invoked", { traceId, userId: options.userId });

      try {
        const event = await createCalendarEvent(options.userId, input, { traceId });
        debugLog("Tool create_calendar_event ok", { traceId, userId: options.userId, eventId: event.id });
        return { connected: true, created: true, event };
      } catch (e: any) {
        if (e instanceof CalendarNotConnectedError) {
          debugLog("Tool create_calendar_event not connected", { traceId, userId: options.userId });
          return {
            connected: false,
            connectUrl,
            created: false,
            message: "Calendar is not connected. User must grant permission.",
          };
        }

        const msg = typeof e?.message === "string" ? e.message : "";
        const needsReauth = /insufficient|scope|forbidden|permission/i.test(msg);
        if (needsReauth) {
          debugLog("Tool create_calendar_event needs reauth", { traceId, userId: options.userId, message: msg });
          return {
            connected: false,
            connectUrl,
            created: false,
            message:
              "Calendar is connected but needs re-authorization with write permissions. Please reconnect Google Calendar.",
          };
        }

        throw e;
      }
    },
  });

  return {
    upcoming_events: upcomingEvents,
    commute_advice_next_event: commuteAdviceForNextEvent,
    create_calendar_event: createCalendarEventTool,
  };
}
