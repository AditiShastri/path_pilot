import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CalendarConnection {
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expiry_date: string | null;
  connected: boolean | null;
}

export interface PathPilotCalendarEvent {
  id: string;
  title: string;
  location: string;
  startTime: string;
  endTime?: string;
}

function getGoogleCalendarConfig(requestUrl?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const fallbackBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const baseUrl = requestUrl ? new URL(requestUrl).origin : fallbackBaseUrl;
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${baseUrl}/api/calendar/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function createGoogleCalendarOAuthClient(requestUrl?: string) {
  const config = getGoogleCalendarConfig(requestUrl);

  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

export function getGoogleCalendarAuthUrl(state: string, requestUrl?: string) {
  const oauth2Client = createGoogleCalendarOAuthClient(requestUrl);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
}

export async function saveCalendarConnection(
  supabase: SupabaseClient,
  input: {
    userId: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiryDate?: number | null;
  }
) {
  const { data: existing, error: existingError } = await supabase
    .from("path_pilot_calendar_connections")
    .select("refresh_token")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const { data, error } = await supabase
    .from("path_pilot_calendar_connections")
    .upsert(
      {
        user_id: input.userId,
        access_token: input.accessToken ?? null,
        refresh_token: input.refreshToken ?? existing?.refresh_token ?? null,
        expiry_date: input.expiryDate
          ? new Date(input.expiryDate).toISOString()
          : null,
        connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("user_id,access_token,refresh_token,expiry_date,connected")
    .single();

  if (error) {
    throw error;
  }

  return data as CalendarConnection;
}

export async function getCalendarConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<CalendarConnection | null> {
  const { data, error } = await supabase
    .from("path_pilot_calendar_connections")
    .select("user_id,access_token,refresh_token,expiry_date,connected")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CalendarConnection | null;
}

export async function disconnectCalendarConnection(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("path_pilot_calendar_connections")
    .update({
      access_token: null,
      refresh_token: null,
      expiry_date: null,
      connected: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id,connected")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getAuthorizedCalendarClient(
  supabase: SupabaseClient,
  userId: string,
  requestUrl?: string
) {
  const connection = await getCalendarConnection(supabase, userId);

  if (!connection?.connected || !connection.refresh_token) {
    throw new Error("Google Calendar is not connected");
  }

  const oauth2Client = createGoogleCalendarOAuthClient(requestUrl);
  oauth2Client.setCredentials({
    access_token: connection.access_token ?? undefined,
    refresh_token: connection.refresh_token,
    expiry_date: connection.expiry_date
      ? new Date(connection.expiry_date).getTime()
      : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (!tokens.access_token && !tokens.refresh_token) {
      return;
    }

    await saveCalendarConnection(supabase, {
      userId,
      accessToken: tokens.access_token ?? connection.access_token,
      refreshToken: tokens.refresh_token ?? connection.refresh_token,
      expiryDate: tokens.expiry_date ?? undefined,
    });
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function getUpcomingCalendarEvents(
  supabase: SupabaseClient,
  userId: string,
  options: {
    requestUrl?: string;
    maxResults?: number;
    timeMin?: Date;
    timeMax?: Date;
  } = {}
): Promise<PathPilotCalendarEvent[]> {
  const calendar = await getAuthorizedCalendarClient(
    supabase,
    userId,
    options.requestUrl
  );

  const response = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    maxResults: options.maxResults ?? 10,
    timeMin: (options.timeMin ?? new Date()).toISOString(),
    timeMax: options.timeMax?.toISOString(),
  });

  return (response.data.items ?? []).flatMap((event) => {
      const startTime = event.start?.dateTime ?? event.start?.date;

      if (!event.id || !startTime) {
        return [];
      }

      const calendarEvent: PathPilotCalendarEvent = {
        id: event.id,
        title: event.summary || "Untitled event",
        location: event.location || "No location",
        startTime,
        endTime: event.end?.dateTime ?? event.end?.date ?? undefined,
      };

      return [calendarEvent];
    });
}
