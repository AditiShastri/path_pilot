import "server-only";

import { NextResponse } from "next/server";
import { calculateTomTomRoute } from "@/lib/tomtom/routing";

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const originLat = toNumber(searchParams.get("originLat"));
  const originLng = toNumber(searchParams.get("originLng"));
  const destLat = toNumber(searchParams.get("destLat"));
  const destLng = toNumber(searchParams.get("destLng"));

  const travelModeRaw = (searchParams.get("travelMode") ?? "car").trim();
  const routeTypeRaw = (searchParams.get("routeType") ?? "fastest").trim();

  if (originLat == null || originLng == null || destLat == null || destLng == null) {
    return NextResponse.json(
      { error: "Missing or invalid coordinates" },
      { status: 400 }
    );
  }

  const travelMode =
    travelModeRaw === "car" ||
    travelModeRaw === "truck" ||
    travelModeRaw === "pedestrian" ||
    travelModeRaw === "bicycle" ||
    travelModeRaw === "motorcycle" ||
    travelModeRaw === "bus"
      ? travelModeRaw
      : "car";

  const routeType = routeTypeRaw === "fastest" || routeTypeRaw === "shortest" || routeTypeRaw === "eco"
    ? routeTypeRaw
    : "fastest";

  try {
    const route = await calculateTomTomRoute({
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      travelMode,
      routeType,
      traffic: true,
    });

    return NextResponse.json(route, {
      status: 200,
      headers: {
        // Ensure API responses aren't cached across users; traffic can change.
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    const message = typeof e?.message === "string" ? e.message : "Route planning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
