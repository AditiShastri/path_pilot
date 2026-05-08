import "server-only";

import { tool } from "ai";
import { z } from "zod";
import {
  getUpcomingEvents,
  listCalendarEvents,
  createCalendarEvent,
  CalendarNotConnectedError,
} from "@/lib/calendar/calendarService";
import { debugLog } from "@/lib/debug/serverDebug";
import { randomUUID } from "crypto";

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toDayRangeUtc(date: string): { timeMin: string; timeMax: string } {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(dayStart.getTime())) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { timeMin: dayStart.toISOString(), timeMax: nextDay.toISOString() };
}

function isValidDate(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

export function createCalendarTools(options: { userId: string; baseUrl: string }) {
  const connectUrl = new URL("/auth/google-calendar/connect", options.baseUrl).toString();

  const upcomingEvents = tool({
    description:
      "Fetch Google Calendar events by time window. Use date (YYYY-MM-DD) for all events on a day, or timeMin/timeMax (RFC3339) for specific limits. Defaults to next 24 hours if no filter is provided.",
    inputSchema: z.object({
      date: z
        .string()
        .optional()
        .describe("Optional day in YYYY-MM-DD. Returns all events in that UTC day."),
      timeMin: z
        .string()
        .optional()
        .describe("Optional lower time bound in RFC3339, e.g. 2026-05-08T09:00:00-04:00"),
      timeMax: z
        .string()
        .optional()
        .describe("Optional upper time bound in RFC3339, e.g. 2026-05-08T18:00:00-04:00"),
      requireLocation: z
        .boolean()
        .optional()
        .describe("Set true to return only events that include a location."),
      maxResults: z.number().int().min(1).max(250).optional().describe("Optional maximum number of events to return."),
    }),
    execute: async (input) => {
      const traceId = randomUUID();
      debugLog("Tool upcoming_events invoked", { traceId, userId: options.userId, input });
      try {
        const hasDate = typeof input.date === "string" && input.date.length > 0;
        const hasMin = typeof input.timeMin === "string" && input.timeMin.length > 0;
        const hasMax = typeof input.timeMax === "string" && input.timeMax.length > 0;

        if (hasDate && !isIsoDate(input.date!)) {
          return {
            connected: true,
            events: [],
            message: "Invalid date format. Please use YYYY-MM-DD.",
          };
        }

        if (hasDate && (hasMin || hasMax)) {
          return {
            connected: true,
            events: [],
            message: "Use either date OR timeMin/timeMax, not both in the same request.",
          };
        }

        let events;
        if (hasDate) {
          const { timeMin, timeMax } = toDayRangeUtc(input.date!);
          events = await listCalendarEvents(
            options.userId,
            {
              timeMin,
              timeMax,
              maxResults: input.maxResults ?? 100,
              requireLocation: input.requireLocation ?? false,
            },
            { traceId }
          );
        } else if (hasMin || hasMax) {
          if (!hasMin || !hasMax) {
            return {
              connected: true,
              events: [],
              message: "When using time limits, provide both timeMin and timeMax in RFC3339 format.",
            };
          }
          events = await listCalendarEvents(
            options.userId,
            {
              timeMin: input.timeMin!,
              timeMax: input.timeMax!,
              maxResults: input.maxResults ?? 100,
              requireLocation: input.requireLocation ?? false,
            },
            { traceId }
          );
        } else {
          events = await getUpcomingEvents(options.userId, { traceId });
        }
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

  const createCalendarEventTool = tool({
    description:
      "Create a Google Calendar event for the authenticated user (primary calendar). The assistant should infer title, time, and location from conversation context when possible. Requires Google Calendar to be connected with write permissions.",
    inputSchema: z.object({
      title: z.string().min(1).describe("Event title/summary"),
      startTime: z
        .string()
        .min(1)
        .describe("Event start time in RFC3339, e.g. 2026-05-08T15:00:00-04:00"),
      endTime: z
        .string()
        .optional()
        .describe("Event end time in RFC3339, e.g. 2026-05-08T16:00:00-04:00"),
      durationMinutes: z
        .number()
        .int()
        .min(5)
        .max(24 * 60)
        .optional()
        .describe("Optional duration in minutes if endTime is not explicitly provided"),
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
        const startDate = new Date(input.startTime);
        if (!Number.isFinite(startDate.getTime())) {
          return {
            connected: true,
            created: false,
            message: "Invalid startTime. Use RFC3339 format.",
          };
        }

        let resolvedEndTime: string | undefined = input.endTime;
        if (!resolvedEndTime && typeof input.durationMinutes === "number") {
          const endMs = startDate.getTime() + input.durationMinutes * 60 * 1000;
          resolvedEndTime = new Date(endMs).toISOString();
        }

        if (!resolvedEndTime) {
          return {
            connected: true,
            created: false,
            message: "Provide either endTime or durationMinutes.",
          };
        }

        if (!isValidDate(resolvedEndTime)) {
          return {
            connected: true,
            created: false,
            message: "Invalid endTime. Use RFC3339 format.",
          };
        }

        if (new Date(resolvedEndTime).getTime() <= startDate.getTime()) {
          return {
            connected: true,
            created: false,
            message: "endTime must be after startTime.",
          };
        }

        const event = await createCalendarEvent(
          options.userId,
          {
            ...input,
            endTime: resolvedEndTime,
          },
          { traceId }
        );
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
    create_calendar_event: createCalendarEventTool,
  };
}
