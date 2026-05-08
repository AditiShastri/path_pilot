import "server-only";

import { NextResponse } from "next/server";

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  // Keep this conservative to avoid hammering the public endpoint.
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "6");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim usage policy asks for an identifying UA; server-side we can provide one.
        "User-Agent": "path-pilot/0.1 (geocoding)",
        Accept: "application/json",
      },
      // Cache a little to reduce repeated searches.
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const data = (await res.json()) as NominatimResult[];
    const results = (Array.isArray(data) ? data : [])
      .map((r) => {
        const lat = toNumber(r.lat);
        const lng = toNumber(r.lon);
        if (lat == null || lng == null) return null;
        return {
          label: r.display_name ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          lat,
          lng,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
