import "server-only";

export type TomTomLatLng = { lat: number; lng: number };

export type TomTomRouteOptions = {
  origin: TomTomLatLng;
  destination: TomTomLatLng;
  travelMode?: "car" | "truck" | "pedestrian" | "bicycle" | "motorcycle" | "bus";
  routeType?: "fastest" | "shortest" | "eco";
  traffic?: boolean;
};

export type TomTomRoute = {
  provider: "tomtom";
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds?: number;
    departureTime?: string;
    arrivalTime?: string;
  };
  points: Array<{ lat: number; lng: number }>;
};

export type TomTomGeocodeResult = {
  query: string;
  formattedAddress: string;
  position: TomTomLatLng;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCoords(coords: TomTomLatLng): void {
  if (!isFiniteNumber(coords.lat) || !isFiniteNumber(coords.lng)) {
    throw new Error("Invalid coordinates");
  }
  if (coords.lat < -90 || coords.lat > 90 || coords.lng < -180 || coords.lng > 180) {
    throw new Error("Coordinates out of range");
  }
}

type TomTomRouteResponse = {
  routes?: Array<{
    summary?: {
      lengthInMeters?: number;
      travelTimeInSeconds?: number;
      trafficDelayInSeconds?: number;
      departureTime?: string;
      arrivalTime?: string;
    };
    legs?: Array<{
      points?: Array<{ latitude?: number; longitude?: number }>;
    }>;
  }>;
  detailedError?: { code?: string; message?: string };
};

type TomTomGeocodeResponse = {
  results?: Array<{
    address?: { freeformAddress?: string };
    position?: { lat?: number; lon?: number };
  }>;
  errorText?: string;
};

export async function geocodeTomTomAddress(query: string): Promise<TomTomGeocodeResult> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TOMTOM_API_KEY");
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("Address query is required");
  }

  const encodedQuery = encodeURIComponent(trimmedQuery);
  const url = new URL(`https://api.tomtom.com/search/2/geocode/${encodedQuery}.json`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TomTom geocoding error: ${res.status} ${text.slice(0, 500)}`);
  }

  let data: TomTomGeocodeResponse;
  try {
    data = JSON.parse(text) as TomTomGeocodeResponse;
  } catch {
    throw new Error("TomTom geocoding error: invalid JSON response");
  }

  const first = Array.isArray(data.results) ? data.results[0] : undefined;
  const lat = first?.position?.lat;
  const lng = first?.position?.lon;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    const errText = typeof data.errorText === "string" ? data.errorText : null;
    throw new Error(errText ? `TomTom geocoding error: ${errText}` : `No geocoding result found for "${trimmedQuery}"`);
  }

  const formattedAddress = (first?.address?.freeformAddress ?? trimmedQuery).trim() || trimmedQuery;
  return {
    query: trimmedQuery,
    formattedAddress,
    position: { lat, lng },
  };
}

export async function calculateTomTomRoute(options: TomTomRouteOptions): Promise<TomTomRoute> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TOMTOM_API_KEY");
  }

  validateCoords(options.origin);
  validateCoords(options.destination);

  const travelMode = options.travelMode ?? "car";
  const routeType = options.routeType ?? "fastest";
  const traffic = options.traffic ?? true;

  const routePlanningLocations = `${options.origin.lat},${options.origin.lng}:${options.destination.lat},${options.destination.lng}`;
  const url = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${routePlanningLocations}/json`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("travelMode", travelMode);
  url.searchParams.set("routeType", routeType);
  url.searchParams.set("traffic", traffic ? "true" : "false");
  url.searchParams.set("routeRepresentation", "polyline");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    // Avoid caching route results; they may be traffic-dependent.
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    // TomTom sometimes returns XML for auth/quota errors.
    throw new Error(`TomTom routing error: ${res.status} ${text.slice(0, 500)}`);
  }

  let data: TomTomRouteResponse;
  try {
    data = JSON.parse(text) as TomTomRouteResponse;
  } catch {
    throw new Error("TomTom routing error: invalid JSON response");
  }

  const route = Array.isArray(data.routes) ? data.routes[0] : undefined;
  const summary = route?.summary;

  const lengthInMeters = summary?.lengthInMeters;
  const travelTimeInSeconds = summary?.travelTimeInSeconds;

  if (!isFiniteNumber(lengthInMeters) || !isFiniteNumber(travelTimeInSeconds)) {
    const msg = data.detailedError?.message;
    throw new Error(msg ? `TomTom routing error: ${msg}` : "TomTom routing error: missing summary");
  }

  const points: Array<{ lat: number; lng: number }> = [];
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  for (const leg of legs) {
    const legPoints = Array.isArray(leg.points) ? leg.points : [];
    for (const p of legPoints) {
      const lat = p?.latitude;
      const lng = p?.longitude;
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue;
      points.push({ lat, lng });
    }
  }

  return {
    provider: "tomtom",
    summary: {
      lengthInMeters,
      travelTimeInSeconds,
      trafficDelayInSeconds: isFiniteNumber(summary?.trafficDelayInSeconds)
        ? summary?.trafficDelayInSeconds
        : undefined,
      departureTime: typeof summary?.departureTime === "string" ? summary.departureTime : undefined,
      arrivalTime: typeof summary?.arrivalTime === "string" ? summary.arrivalTime : undefined,
    },
    points,
  };
}
