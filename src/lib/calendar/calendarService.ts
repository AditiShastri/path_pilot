import "server-only";

import { getGoogleCalendarClient, CalendarNotConnectedError } from "@/lib/google/calendarClient";
import type { UpcomingCalendarEvent, CreateCalendarEventInput, CreatedCalendarEvent } from "@/lib/calendar/types";
import { debugLog } from "@/lib/debug/serverDebug";

type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

function toEvent(item: GoogleCalendarEvent): UpcomingCalendarEvent | null {
  if (!item.id) return null;
  if (item.status === "cancelled") return null;

  const location = (item.location ?? "").trim();
  if (!location) return null;

  const startTime = item.start?.dateTime ?? item.start?.date;
  const endTime = item.end?.dateTime ?? item.end?.date;
  if (!startTime || !endTime) return null;

  return {
    id: item.id,
    title: (item.summary ?? "(No title)").trim() || "(No title)",
    location,
    startTime,
    endTime,
  };
}

export async function getUpcomingEvents(
  userId: string,
  debug?: { traceId?: string }
): Promise<UpcomingCalendarEvent[]> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const traceId = debug?.traceId;
  debugLog("getUpcomingEvents start", {
    traceId,
    userId,
    timeMin: now.toISOString(),
    timeMax: in24h.toISOString(),
  });

  const client = await getGoogleCalendarClient(userId);
  const data = await client.listPrimaryEvents({
    timeMin: now.toISOString(),
    timeMax: in24h.toISOString(),
    maxResults: 25,
  });

  const items = (data?.items ?? []) as GoogleCalendarEvent[];

  let cancelled = 0;
  let noLocation = 0;
  let noTimes = 0;
  let noId = 0;

  for (const it of items) {
    if (!it.id) {
      noId++;
      continue;
    }
    if (it.status === "cancelled") {
      cancelled++;
      continue;
    }
    const location = (it.location ?? "").trim();
    if (!location) {
      noLocation++;
      continue;
    }
    const startTime = it.start?.dateTime ?? it.start?.date;
    const endTime = it.end?.dateTime ?? it.end?.date;
    if (!startTime || !endTime) {
      noTimes++;
      continue;
    }
  }

  debugLog("Google events fetched", {
    traceId,
    userId,
    rawItems: items.length,
    filteredOut: { noId, cancelled, noLocation, noTimes },
  });

  // Helpful sample to confirm if Google returned events but without locations.
  debugLog("Google events sample flags", {
    traceId,
    userId,
    sample: items.slice(0, 3).map((it) => ({
      id: it.id ?? null,
      status: it.status ?? null,
      hasLocation: Boolean((it.location ?? "").trim()),
      hasStart: Boolean(it.start?.dateTime ?? it.start?.date),
      hasEnd: Boolean(it.end?.dateTime ?? it.end?.date),
    })),
  });

  const events = items.map(toEvent).filter(Boolean) as UpcomingCalendarEvent[];

  debugLog("Upcoming events after filtering", {
    traceId,
    userId,
    count: events.length,
  });
  return events;
}

type GoogleCalendarCreatedEvent = {
  id?: string;
  htmlLink?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export async function createCalendarEvent(
  userId: string,
  input: CreateCalendarEventInput,
  debug?: { traceId?: string }
): Promise<CreatedCalendarEvent> {
  const traceId = debug?.traceId;

  debugLog("createCalendarEvent start", {
    traceId,
    userId,
    title: input.title,
    hasLocation: Boolean((input.location ?? "").trim()),
    hasAttendees: Array.isArray(input.attendees) ? input.attendees.length : 0,
  });

  const client = await getGoogleCalendarClient(userId);

  const created = (await client.insertPrimaryEvent({
    summary: input.title,
    description: input.description,
    location: input.location,
    start: input.timeZone
      ? { dateTime: input.startTime, timeZone: input.timeZone }
      : { dateTime: input.startTime },
    end: input.timeZone
      ? { dateTime: input.endTime, timeZone: input.timeZone }
      : { dateTime: input.endTime },
    attendees: (input.attendees ?? []).map((email) => ({ email })),
  })) as GoogleCalendarCreatedEvent;

  if (!created?.id) {
    throw new Error("Google Calendar API returned no event id");
  }

  const startTime = created.start?.dateTime ?? created.start?.date ?? input.startTime;
  const endTime = created.end?.dateTime ?? created.end?.date ?? input.endTime;

  debugLog("createCalendarEvent ok", {
    traceId,
    userId,
    eventId: created.id,
  });

  return {
    id: created.id,
    htmlLink: created.htmlLink,
    title: (created.summary ?? input.title).trim() || input.title,
    startTime,
    endTime,
    location: (created.location ?? input.location)?.trim() || undefined,
  };
}

export { CalendarNotConnectedError };
