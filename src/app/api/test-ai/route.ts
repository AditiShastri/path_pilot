import { generateReminder } from "@/lib/ai";

export async function GET() {
  const reminder = await generateReminder({
    title: "Team Meeting",
    startTime: "10:00 AM",
    travelDuration: "52 mins",
    location: "MG Road Bangalore",
  });

  return Response.json({
    reminder,
  });
}
