import "server-only";

import { getGoogleCalendarClient, CalendarNotConnectedError } from "@/lib/google/calendarClient";
import type { UpcomingCalendarEvent } from "@/lib/calendar/types";
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

export { CalendarNotConnectedError };
