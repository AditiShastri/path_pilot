import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/google/calendarOAuth";
import { debugLog } from "@/lib/debug/serverDebug";

export class CalendarNotConnectedError extends Error {
  constructor(message = "Google Calendar not connected") {
    super(message);
    this.name = "CalendarNotConnectedError";
  }
}

type CalendarConnectionRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expiry_date: string | null;
  connected: boolean | null;
};

function isExpiringSoon(expiryDateIso: string | null, skewMs = 60_000) {
  if (!expiryDateIso) return true;
  const t = Date.parse(expiryDateIso);
  if (!Number.isFinite(t)) return true;
  return t - Date.now() <= skewMs;
}

async function loadConnection(userId: string): Promise<CalendarConnectionRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("path_pilot_calendar_connections")
    .select("user_id, access_token, refresh_token, expiry_date, connected")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load calendar connection: ${error.message}`);
  }

  debugLog("Calendar connection loaded", {
    userId,
    found: Boolean(data),
    connected: (data as any)?.connected ?? null,
    hasAccessToken: Boolean((data as any)?.access_token),
    hasRefreshToken: Boolean((data as any)?.refresh_token),
    expiry_date: (data as any)?.expiry_date ?? null,
  });

  return (data as CalendarConnectionRow) ?? null;
}

async function saveRefreshedToken(userId: string, accessToken: string, expiryDateIso: string | null) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("path_pilot_calendar_connections")
    .update({
      access_token: accessToken,
      expiry_date: expiryDateIso,
      connected: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to update calendar token: ${error.message}`);
  }
}

async function markDisconnected(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("path_pilot_calendar_connections")
    .update({ connected: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function getValidCalendarAccessToken(userId: string): Promise<string> {
  const connection = await loadConnection(userId);

  if (!connection || !connection.connected) {
    throw new CalendarNotConnectedError();
  }

  if (!connection.refresh_token) {
    throw new CalendarNotConnectedError("Google Calendar connection is missing a refresh token");
  }

  if (!isExpiringSoon(connection.expiry_date)) {
    debugLog("Calendar access token still valid", { userId, expiry_date: connection.expiry_date });
    return connection.access_token;
  }

  try {
    debugLog("Refreshing Calendar access token", { userId, expiry_date: connection.expiry_date });
    const refreshed = await refreshAccessToken(connection.refresh_token);
    const expiryDateIso = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      : null;

    await saveRefreshedToken(userId, refreshed.access_token, expiryDateIso);
    debugLog("Calendar access token refreshed", { userId, expiry_date: expiryDateIso });
    return refreshed.access_token;
  } catch (e) {
    debugLog("Calendar token refresh failed; marking disconnected", { userId });
    await markDisconnected(userId);
    throw e;
  }
}

export type GoogleCalendarClient = {
  listPrimaryEvents: (params: {
    timeMin: string;
    timeMax: string;
    maxResults?: number;
  }) => Promise<any>;
};

export async function getGoogleCalendarClient(userId: string): Promise<GoogleCalendarClient> {
  const accessToken = await getValidCalendarAccessToken(userId);

  return {
    async listPrimaryEvents({ timeMin, timeMax, maxResults = 25 }) {
      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", String(maxResults));
      url.searchParams.set("showDeleted", "false");

      debugLog("Calling Google Calendar API", {
        userId,
        calendarId: "primary",
        timeMin,
        timeMax,
        maxResults,
      });

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const json = (await res.json()) as any;
      if (!res.ok) {
        debugLog("Google Calendar API error", {
          userId,
          status: res.status,
          statusText: res.statusText,
          message: json?.error?.message ?? null,
        });
        throw new Error(`Google Calendar API error: ${json?.error?.message ?? res.statusText}`);
      }

      debugLog("Google Calendar API ok", {
        userId,
        status: res.status,
        items: Array.isArray(json?.items) ? json.items.length : null,
      });

      return json;
    },
  };
}
