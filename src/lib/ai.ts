interface ReminderInput {
  title: string;
  startTime: string;
  travelDuration: string;
  location: string;
  eventStartTime?: string;
  reminderWindowMinutes?: number;
}

export async function generateReminder(input: ReminderInput): Promise<string> {
  console.log("Generating AI reminder...");

  if (input.reminderWindowMinutes !== undefined) {
    const startTime = input.eventStartTime ? ` at ${input.eventStartTime}` : "";
    return `Reminder: ${input.title} at ${input.location} starts in about ${input.reminderWindowMinutes} minutes${startTime}. Travel time is approximately ${input.travelDuration}. Leave now if you are not already on the way.`;
  }

  return `Reminder: ${input.title} at ${input.location}. Travel time is approximately ${input.travelDuration}. Leave early to avoid delays.`;
}
