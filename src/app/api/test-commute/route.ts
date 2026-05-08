import { buildCommutePlan } from "@/lib/commute-assistant";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get("q") || "I want to go to MG Road";

  return Response.json(
    await buildCommutePlan({
      message,
      destination: searchParams.get("destination") ?? undefined,
      requestedStartTime: searchParams.get("startTime") ?? undefined,
      action:
        (searchParams.get("action") as
          | "plan"
          | "create_event"
          | "book_cab"
          | "book_auto"
          | "book_metro"
          | null) ?? undefined,
    })
  );
}
