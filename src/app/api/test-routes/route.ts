import { getTravelEstimate } from "@/lib/routes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin") || "Whitefield Bangalore";
  const destination = searchParams.get("destination") || "MG Road Bangalore";

  const result = await getTravelEstimate(
    origin,
    destination
  );

  return Response.json(result);
}
