export interface TravelEstimate {
  duration: string;
  distance: string;
  mode: string;
  source: "tomtom" | "mock";
  trafficDelay?: string;
  trafficDelaySeconds?: number;
  noTrafficDuration?: string;
  liveTrafficDuration?: string;
  originAddress?: string;
  destinationAddress?: string;
}

interface TomTomPosition {
  lat: number;
  lon: number;
}

interface GeocodeResult {
  position: TomTomPosition;
  address?: {
    freeformAddress?: string;
  };
}

const TOMTOM_GEOCODE_URL = "https://api.tomtom.com/search/2/geocode";
const TOMTOM_ROUTE_URL = "https://api.tomtom.com/routing/1/calculateRoute";

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} mins`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }

  return `${hours} hr ${remainingMinutes} mins`;
}

function formatDistance(meters: number) {
  const kilometers = meters / 1000;

  if (kilometers < 10) {
    return `${kilometers.toFixed(1)} km`;
  }

  return `${Math.round(kilometers)} km`;
}

function getMockTravelEstimate(): TravelEstimate {
  const estimate: TravelEstimate = {
    duration: "52 mins",
    distance: "14 km",
    mode: "CAR",
    source: "mock",
    trafficDelay: "Mock traffic delay unavailable",
  };

  console.log("[Route estimate] Mock fallback estimate:", estimate);
  return estimate;
}

async function geocodeLocation(query: string, apiKey: string): Promise<GeocodeResult> {
  const url = new URL(`${TOMTOM_GEOCODE_URL}/${encodeURIComponent(query)}.json`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrySet", "IN");
  url.searchParams.set("lat", "12.9716");
  url.searchParams.set("lon", "77.5946");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TomTom geocoding failed: ${response.statusText}`);
  }

  const data = await response.json();
  const result = data?.results?.[0];

  if (!result?.position) {
    throw new Error(`TomTom could not geocode location: ${query}`);
  }

  return result;
}

export async function getTravelEstimate(
  origin: string,
  destination: string
): Promise<TravelEstimate> {
  console.log(`Calculating travel estimate from ${origin} to ${destination}...`);

  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    console.warn("Missing TOMTOM_API_KEY. Falling back to mock route estimate.");
    return getMockTravelEstimate();
  }

  try {
    const [originResult, destinationResult] = await Promise.all([
      geocodeLocation(origin, apiKey),
      geocodeLocation(destination, apiKey),
    ]);

    const originPosition = originResult.position;
    const destinationPosition = destinationResult.position;
    const routeUrl = new URL(
      `${TOMTOM_ROUTE_URL}/${originPosition.lat},${originPosition.lon}:${destinationPosition.lat},${destinationPosition.lon}/json`
    );

    routeUrl.searchParams.set("key", apiKey);
    routeUrl.searchParams.set("traffic", "true");
    routeUrl.searchParams.set("travelMode", "car");
    routeUrl.searchParams.set("routeRepresentation", "summaryOnly");
    routeUrl.searchParams.set("computeTravelTimeFor", "all");

    const response = await fetch(routeUrl);
    if (!response.ok) {
      throw new Error(`TomTom routing failed: ${response.statusText}`);
    }

    const data = await response.json();
    const summary = data?.routes?.[0]?.summary;

    if (!summary) {
      throw new Error("TomTom routing returned no route summary");
    }

    console.log("[TomTom route estimate] Raw summary:", {
      origin,
      destination,
      originPosition,
      destinationPosition,
      originAddress: originResult.address?.freeformAddress,
      destinationAddress: destinationResult.address?.freeformAddress,
      lengthInMeters: summary.lengthInMeters,
      travelTimeInSeconds: summary.travelTimeInSeconds,
      trafficDelayInSeconds: summary.trafficDelayInSeconds,
      trafficLengthInMeters: summary.trafficLengthInMeters,
      noTrafficTravelTimeInSeconds: summary.noTrafficTravelTimeInSeconds,
      historicTrafficTravelTimeInSeconds: summary.historicTrafficTravelTimeInSeconds,
      liveTrafficIncidentsTravelTimeInSeconds:
        summary.liveTrafficIncidentsTravelTimeInSeconds,
      departureTime: summary.departureTime,
      arrivalTime: summary.arrivalTime,
    });

    const estimate: TravelEstimate = {
      duration: formatDuration(summary.travelTimeInSeconds),
      distance: formatDistance(summary.lengthInMeters),
      mode: "CAR",
      source: "tomtom",
      trafficDelay: formatDuration(summary.trafficDelayInSeconds ?? 0),
      trafficDelaySeconds: summary.trafficDelayInSeconds ?? 0,
      noTrafficDuration:
        typeof summary.noTrafficTravelTimeInSeconds === "number"
          ? formatDuration(summary.noTrafficTravelTimeInSeconds)
          : undefined,
      liveTrafficDuration:
        typeof summary.liveTrafficIncidentsTravelTimeInSeconds === "number"
          ? formatDuration(summary.liveTrafficIncidentsTravelTimeInSeconds)
          : undefined,
      originAddress: originResult.address?.freeformAddress,
      destinationAddress: destinationResult.address?.freeformAddress,
    };

    console.log("[TomTom route estimate] Normalized estimate:", estimate);
    return estimate;
  } catch (error) {
    console.error("TomTom route estimate failed:", error);
    return getMockTravelEstimate();
  }
}
