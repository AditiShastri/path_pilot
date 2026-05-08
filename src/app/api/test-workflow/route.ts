import { processDueEventReminders, processEvents } from "@/jobs/process-events";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const nowParam = searchParams.get("now");
  const dryRun = searchParams.get("dryRun") === "true";

  const result =
    mode === "due"
      ? await processDueEventReminders(nowParam ? new Date(nowParam) : new Date(), {
          dryRun,
        })
      : await processEvents();

  return Response.json(result);
}
