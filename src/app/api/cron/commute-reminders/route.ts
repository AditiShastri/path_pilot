import { processDueEventReminders } from "@/jobs/process-events";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await processDueEventReminders();

  return Response.json(result);
}
