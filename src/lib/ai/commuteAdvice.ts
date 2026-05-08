import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import type { UpcomingCalendarEvent } from "@/lib/calendar/types";

export const CommuteAdviceSchema = z.object({
  urgency: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  recommendation: z.string(),
});

export type CommuteAdvice = z.infer<typeof CommuteAdviceSchema>;

export async function generateCommuteAdvice(event: UpcomingCalendarEvent): Promise<CommuteAdvice> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    temperature: 0.2,
    schema: CommuteAdviceSchema,
    prompt: `You are Path Pilot. Generate commute guidance for the event below.

Event:
- Title: ${event.title}
- Location: ${event.location}
- Start: ${event.startTime}
- End: ${event.endTime}

Rules:
- Do NOT estimate travel time or distance.
- Base urgency only on how soon the start time is and any obvious cues in the text.
- Provide a short summary and a practical leave recommendation (relative timing).
`,
  });

  return object;
}
