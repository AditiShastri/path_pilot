import { generateReminder } from "@/lib/ai";
import { mockEvents } from "@/lib/mock-events";
import { getTravelEstimate } from "@/lib/routes";
import { sendTelegramReply } from "@/lib/telegram";

const HOME_LOCATION = "Whitefield Bangalore";
const REMINDER_WINDOW_MINUTES = 30;
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

function getChatId() {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new Error("Missing TELEGRAM_CHAT_ID environment variable");
  }

  return chatId;
}

export async function processEvents() {
  console.log("Starting event processing...");

  const chatId = getChatId();

  for (const event of mockEvents) {
    console.log(`Processing event: ${event.title}`);

    const route = await getTravelEstimate(HOME_LOCATION, event.location);

    const reminder = await generateReminder({
      title: event.title,
      startTime: event.startTime,
      travelDuration: route.duration,
      location: event.location,
    });

    await sendTelegramReply(chatId, reminder);

    console.log("Reminder sent successfully");
  }

  return {
    success: true,
    processedEvents: mockEvents.length,
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

  const chatId = options.dryRun ? null : getChatId();
  const sentEvents = [];
  const skippedEvents = [];

  for (const event of mockEvents) {
    const minutes = minutesUntil(event.startTime, now);
    const reminderKey = `${event.id}:${event.startTime}`;
    const isDue = minutes >= 0 && minutes <= REMINDER_WINDOW_MINUTES;

    if (!isDue) {
      skippedEvents.push({
        id: event.id,
        title: event.title,
        minutesUntilStart: minutes,
        reason: "Not within the 30-minute reminder window",
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
      location: event.location,
      eventStartTime,
      reminderWindowMinutes: minutes,
    });

    if (!options.dryRun && chatId) {
      await sendTelegramReply(chatId, reminder);
      sentReminderKeys.add(reminderKey);
    }

    sentEvents.push({
      id: event.id,
      title: event.title,
      location: event.location,
      minutesUntilStart: minutes,
      dryRun: Boolean(options.dryRun),
      message: reminder,
    });
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
