import { processDueEventReminders } from "@/jobs/process-events";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nowParam = searchParams.get("now");
  const dryRun = searchParams.get("dryRun") === "true";

  const result = await processDueEventReminders(nowParam ? new Date(nowParam) : new Date(), {
    dryRun,
  });

  return Response.json(result);
}
