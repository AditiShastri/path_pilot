import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatLng(lat: unknown, lng: unknown) {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("path_pilot_users")
      .select("home_lat, home_lng")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Failed to load home location" }, { status: 500 });
    }

    return NextResponse.json({
      home: data?.home_lat != null && data?.home_lng != null
        ? { lat: data.home_lat, lng: data.home_lng }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load home location" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const lat = body?.lat;
  const lng = body?.lng;

  if (!isValidLatLng(lat, lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from("path_pilot_users")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          home_lat: lat,
          home_lng: lng,
        },
        { onConflict: "id" }
      );

    if (error) {
      return NextResponse.json({ error: "Failed to save home location" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, home: { lat, lng } });
  } catch {
    return NextResponse.json({ error: "Failed to save home location" }, { status: 500 });
  }
}
