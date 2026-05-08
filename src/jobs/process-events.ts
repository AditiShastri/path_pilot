import { generateReminder } from "@/lib/ai";
import { mockEvents } from "@/lib/mock-events";
import { getTravelEstimate } from "@/lib/routes";
import { sendTelegramReply } from "@/lib/telegram";
import { getConnectedTelegramChatIds } from "@/lib/telegram-db";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUpcomingCalendarEvents } from "@/lib/google-calendar";
import type { CalendarEvent } from "@/types/event";

const HOME_LOCATION = "Whitefield Bangalore";
const REMINDER_WINDOW_MINUTES = 10;
const sentReminderKeys = new Set<string>();

function minutesUntil(startTime: string, now: Date) {
  return Math.round((new Date(startTime).getTime() - now.getTime()) / 60000);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

async function getConnectedChatIds() {
  const recipients = await getConnectedTelegramChatIds();
  if (recipients.length === 0) {
    throw new Error("No connected Telegram chat ids found in path_pilot_users");
  }

  return recipients;
}

async function getEventsForRecipient(userId: string, now: Date): Promise<CalendarEvent[]> {
  try {
    const supabase = createAdminClient();
    const events = await getUpcomingCalendarEvents(supabase, userId, {
      maxResults: 20,
      timeMin: now,
      timeMax: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });

    if (events.length > 0) {
      console.log(`[Calendar reminders] Loaded ${events.length} Google Calendar events for user ${userId}`);
      return events;
    }
  } catch (error) {
    console.warn(
      `[Calendar reminders] Falling back to mock events for user ${userId}:`,
      error
    );
  }

  return mockEvents;
}

export async function processEvents() {
  console.log("Starting event processing...");

  const recipients = await getConnectedChatIds();
  let sentCount = 0;

  for (const event of mockEvents) {
    console.log(`Processing event: ${event.title}`);

    const route = await getTravelEstimate(HOME_LOCATION, event.location);

    const reminder = await generateReminder({
      title: event.title,
      startTime: event.startTime,
      travelDuration: route.duration,
      distance: route.distance,
      trafficDelay: route.trafficDelay,
      noTrafficDuration: route.noTrafficDuration,
      liveTrafficDuration: route.liveTrafficDuration,
      routeSource: route.source,
      origin: HOME_LOCATION,
      location: event.location,
    });

    for (const recipient of recipients) {
      await sendTelegramReply(recipient.chatId, reminder);
      sentCount += 1;
    }

    console.log("Reminder sent successfully");
  }

  return {
    success: true,
    processedEvents: mockEvents.length,
    recipients: recipients.length,
    sentCount,
  };
}

interface ReminderRunOptions {
  dryRun?: boolean;
}

export async function processDueEventReminders(
  now = new Date(),
  options: ReminderRunOptions = {}
) {
  console.log("Checking for due event reminders...");

  const recipients = options.dryRun ? [] : await getConnectedChatIds();
  const sentEvents = [];
  const skippedEvents = [];
  const eventsByRecipient =
    options.dryRun
      ? [{ userId: "dry-run", chatId: null, events: mockEvents }]
      : await Promise.all(
          recipients.map(async (recipient) => ({
            ...recipient,
            events: await getEventsForRecipient(recipient.userId, now),
          }))
        );

  for (const recipientEvents of eventsByRecipient) {
    for (const event of recipientEvents.events) {
      const minutes = minutesUntil(event.startTime, now);
      const reminderKey = `${recipientEvents.userId}:${event.id}:${event.startTime}`;
      const isDue = minutes >= 0 && minutes <= REMINDER_WINDOW_MINUTES;

      if (!isDue) {
        skippedEvents.push({
          id: event.id,
          title: event.title,
          minutesUntilStart: minutes,
          reason: `Not within the ${REMINDER_WINDOW_MINUTES}-minute reminder window`,
        });
        continue;
      }

      if (sentReminderKeys.has(reminderKey)) {
        skippedEvents.push({
          id: event.id,
          title: event.title,
          minutesUntilStart: minutes,
          reason: "Reminder already sent in this server session",
        });
        continue;
      }

      const route = await getTravelEstimate(HOME_LOCATION, event.location);
      const eventStartTime = formatTime(new Date(event.startTime));
      const reminder = await generateReminder({
        title: event.title,
        startTime: event.startTime,
        travelDuration: route.duration,
        distance: route.distance,
        trafficDelay: route.trafficDelay,
        noTrafficDuration: route.noTrafficDuration,
        liveTrafficDuration: route.liveTrafficDuration,
        routeSource: route.source,
        origin: HOME_LOCATION,
        location: event.location,
        eventStartTime,
        reminderWindowMinutes: minutes,
      });

      if (!options.dryRun) {
        if (recipientEvents.chatId) {
          await sendTelegramReply(recipientEvents.chatId, reminder);
        }
        sentReminderKeys.add(reminderKey);
      }

      sentEvents.push({
        id: event.id,
        title: event.title,
        location: event.location,
        minutesUntilStart: minutes,
        dryRun: Boolean(options.dryRun),
        recipients: options.dryRun ? 0 : 1,
        userId: recipientEvents.userId,
        message: reminder,
      });
    }
  }

  return {
    success: true,
    now: now.toISOString(),
    dryRun: Boolean(options.dryRun),
    reminderWindowMinutes: REMINDER_WINDOW_MINUTES,
    sentCount: sentEvents.length,
    sentEvents,
    skippedEvents,
  };
}
