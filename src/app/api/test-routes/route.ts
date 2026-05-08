import { getTravelEstimate } from "@/lib/routes";

export async function GET() {
  const result = await getTravelEstimate(
    "Whitefield Bangalore",
    "MG Road Bangalore"
  );

  return Response.json(result);
}
