import { mockEvents } from "@/lib/mock-events";
import { getTravelEstimate } from "@/lib/routes";

type TravelMode = "METRO" | "CAB" | "AUTO" | "TRANSIT";

interface ModeEstimate {
  mode: TravelMode;
  durationMinutes: number;
  duration: string;
  distance: string;
  cost: string;
  notes: string;
  score: number;
  bookingUrl?: string;
}

interface CommutePlanOptions {
  message: string;
  destination?: string;
  origin?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  requestedStartTime?: string;
  action?: "plan" | "create_event" | "book_cab" | "book_auto" | "book_metro";
}

const DEFAULT_ORIGIN = "Whitefield Bangalore";
const BUFFER_MINUTES = 10;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function getModeEstimates(destination: string, roadTrafficEstimate?: any): ModeEstimate[] {
  const normalizedDestination = normalize(destination);

  // For MG Road - keep existing mock data
  if (normalizedDestination.includes("mg road")) {
    return [
      {
        mode: "METRO",
        durationMinutes: 38,
        duration: "38 mins",
        distance: "15 km",
        cost: "Rs. 60",
        notes: "Fastest and most predictable for MG Road; short walk from the station.",
        score: 95,
        bookingUrl: "https://www.bmrc.co.in/",
      },
      {
        mode: "CAB",
        durationMinutes: 44,
        duration: "44 mins",
        distance: "14 km",
        cost: "Rs. 420",
        notes: "Door-to-door, but traffic around MG Road can be slow.",
        score: 78,
        bookingUrl: "https://www.olacabs.com/",
      },
      {
        mode: "AUTO",
        durationMinutes: 49,
        duration: "49 mins",
        distance: "14 km",
        cost: "Rs. 260",
        notes: "Flexible, but less comfortable for longer stretches.",
        score: 72,
        bookingUrl: "https://www.uber.com/in/en/ride/",
      },
      {
        mode: "TRANSIT",
        durationMinutes: 52,
        duration: "52 mins",
        distance: "14 km",
        cost: "Rs. 90",
        notes: "Budget option with more waiting time.",
        score: 66,
        bookingUrl: "https://www.redbus.in/",
      },
    ];
  }

  // For Electronic City - keep existing mock data
  if (normalizedDestination.includes("electronic city")) {
    return [
      {
        mode: "CAB",
        durationMinutes: 58,
        duration: "58 mins",
        distance: "25 km",
        cost: "Rs. 680",
        notes: "Best door-to-door option for Electronic City.",
        score: 88,
        bookingUrl: "https://www.olacabs.com/",
      },
      {
        mode: "AUTO",
        durationMinutes: 72,
        duration: "1 hr 12 mins",
        distance: "25 km",
        cost: "Rs. 430",
        notes: "Possible, but a long auto ride.",
        score: 62,
        bookingUrl: "https://www.uber.com/in/en/ride/",
      },
      {
        mode: "TRANSIT",
        durationMinutes: 86,
        duration: "1 hr 26 mins",
        distance: "27 km",
        cost: "Rs. 120",
        notes: "Cheapest, but slowest and transfer-heavy.",
        score: 58,
        bookingUrl: "https://www.redbus.in/",
      },
      {
        mode: "METRO",
        durationMinutes: 95,
        duration: "1 hr 35 mins",
        distance: "28 km",
        cost: "Rs. 80",
        notes: "Not ideal because the last-mile leg is long.",
        score: 54,
        bookingUrl: "https://www.bmrc.co.in/",
      },
    ];
  }

  // For any other location, use real routing data or generic estimates
  const baseEstimates: ModeEstimate[] = [
    {
      mode: "CAB",
      durationMinutes: roadTrafficEstimate?.duration ? parseInt(roadTrafficEstimate.duration.split(' ')[0]) : 45,
      duration: roadTrafficEstimate?.duration || "45 mins",
      distance: roadTrafficEstimate?.distance || "14 km",
      cost: "Rs. 400",
      notes: roadTrafficEstimate?.source === "tomtom" 
        ? `Real-time estimate. Traffic delay: ${roadTrafficEstimate.trafficDelay || "0 mins"}.`
        : "Generic cab estimate for this destination.",
      score: 80,
      bookingUrl: "https://www.olacabs.com/",
    },
    {
      mode: "AUTO",
      durationMinutes: roadTrafficEstimate?.duration ? parseInt(roadTrafficEstimate.duration.split(' ')[0]) : 52,
      duration: roadTrafficEstimate?.duration || "52 mins",
      distance: roadTrafficEstimate?.distance || "14 km",
      cost: "Rs. 250",
      notes: roadTrafficEstimate?.source === "tomtom"
        ? `Real-time estimate. Traffic delay: ${roadTrafficEstimate.trafficDelay || "0 mins"}.`
        : "Generic auto estimate for this destination.",
      score: 70,
      bookingUrl: "https://www.uber.com/in/en/ride/",
    },
    {
      mode: "METRO",
      durationMinutes: roadTrafficEstimate?.duration ? parseInt(roadTrafficEstimate.duration.split(' ')[0]) : 55,
      duration: roadTrafficEstimate?.duration || "55 mins",
      distance: roadTrafficEstimate?.distance || "15 km",
      cost: "Rs. 70",
      notes: "Metro estimate; station access may vary.",
      score: 68,
      bookingUrl: "https://www.bmrc.co.in/",
    },
    {
      mode: "TRANSIT",
      durationMinutes: roadTrafficEstimate?.duration ? parseInt(roadTrafficEstimate.duration.split(' ')[0]) : 60,
      duration: roadTrafficEstimate?.duration || "1 hr",
      distance: roadTrafficEstimate?.distance || "14 km",
      cost: "Rs. 90",
      notes: "Public transit estimate.",
      score: 60,
      bookingUrl: "https://www.redbus.in/",
    },
  ];

  return baseEstimates;
}

function findMatchingEvent(message: string, destination?: string) {
  const haystack = normalize(`${message} ${destination ?? ""}`);

  return (
    mockEvents.find((event) => {
      const title = normalize(event.title);
      const location = normalize(event.location);
      return haystack.includes(title) || haystack.includes(location);
    }) ??
    mockEvents.find((event) => {
      const locationWords = normalize(event.location).split(" ");
      return locationWords.some((word) => word.length > 3 && haystack.includes(word));
    }) ??
    null
  );
}

function inferDestination(message: string, destination?: string) {
  if (destination?.trim()) {
    return destination.trim();
  }

  const matchedEvent = findMatchingEvent(message);
  if (matchedEvent) {
    return matchedEvent.location;
  }

  const normalizedMessage = normalize(message);
  if (normalizedMessage.includes("mg road")) {
    return "MG Road Bangalore";
  }
  if (normalizedMessage.includes("electronic city")) {
    return "Electronic City Bangalore";
  }

  return null;
}

function inferAction(
  message: string,
  action?: CommutePlanOptions["action"]
): CommutePlanOptions["action"] {
  if (action) {
    return action;
  }

  const normalizedMessage = normalize(message);
  if (normalizedMessage.includes("book") && normalizedMessage.includes("cab")) {
    return "book_cab";
  }
  if (normalizedMessage.includes("book") && normalizedMessage.includes("auto")) {
    return "book_auto";
  }
  if (normalizedMessage.includes("book") && normalizedMessage.includes("metro")) {
    return "book_metro";
  }
  if (
    normalizedMessage.includes("create") ||
    normalizedMessage.includes("schedule") ||
    normalizedMessage.includes("add event") ||
    normalizedMessage.includes("meeting")
  ) {
    return "create_event";
  }

  return "plan";
}

function getConflicts(targetStart: Date, targetEventId?: string) {
  const targetEnd = addMinutes(targetStart, 60);

  return mockEvents
    .filter((event) => event.id !== targetEventId)
    .map((event) => {
      const start = new Date(event.startTime);
      const end = addMinutes(start, 60);
      const overlaps = start < targetEnd && end > targetStart;
      const tightTurnaround =
        Math.abs(start.getTime() - targetStart.getTime()) <= 90 * 60 * 1000;

      if (!overlaps && !tightTurnaround) {
        return null;
      }

      return {
        id: event.id,
        title: event.title,
        location: event.location,
        startTime: event.startTime,
        reason: overlaps
          ? "Time overlaps with this mock event."
          : "This is close enough that commute buffer may be tight.",
      };
    })
    .filter(Boolean);
}

function createMockBooking(mode: TravelMode, destination: string) {
  const bookingId = `MOCK-${mode}-${Date.now().toString().slice(-6)}`;

  return {
    bookingId,
    mode,
    destination,
    status: mode === "METRO" ? "Mock metro route saved" : "Mock ride reserved",
    note:
      mode === "METRO"
        ? "No real ticket was booked. This is a test route confirmation."
        : "No real ride was booked. This is a test booking confirmation.",
  };
}

function inferEventTitle(message: string, destination: string, matchedEvent?: { title: string } | null) {
  if (matchedEvent && normalize(message).includes(normalize(matchedEvent.title))) {
    return matchedEvent.title;
  }

  if (normalize(message).includes("meeting")) {
    return `Meeting at ${destination}`;
  }

  return `Trip to ${destination}`;
}

export async function buildCommutePlan(options: CommutePlanOptions) {
  const action = inferAction(options.message, options.action);
  const destination = inferDestination(options.message, options.destination);

  if (!destination) {
    return {
      success: false,
      message:
        "I could not find that destination in the mock commute data. Try MG Road or Electronic City.",
      knownDestinations: mockEvents.map((event) => event.location),
    };
  }
  // Use current location as origin if available, otherwise fallback to provided origin or default
  const origin = options.currentLocation?.address || 
                 options.origin || 
                 DEFAULT_ORIGIN;
  const matchedEvent = findMatchingEvent(options.message, destination);
  const roadTrafficEstimate = await getTravelEstimate(
    origin,
    destination
  );
  const estimates = getModeEstimates(destination, roadTrafficEstimate).sort((a, b) => b.score - a.score);
  const carLikeEstimate = estimates.find(
    (estimate) => estimate.mode === "CAB" || estimate.mode === "AUTO"
  );

  if (roadTrafficEstimate.source === "tomtom" && carLikeEstimate) {
    carLikeEstimate.duration = roadTrafficEstimate.duration;
    carLikeEstimate.distance = roadTrafficEstimate.distance;
    carLikeEstimate.notes = `${carLikeEstimate.notes} TomTom traffic delay: ${
      roadTrafficEstimate.trafficDelay ?? "0 mins"
    }.`;
  }

  estimates.sort((a, b) => b.score - a.score);
  const recommended = estimates[0];
  const startTime = new Date(
    options.requestedStartTime || matchedEvent?.startTime || "2026-05-09T10:00:00+05:30"
  );
  const leaveAt = addMinutes(startTime, -(recommended.durationMinutes + BUFFER_MINUTES));
  const conflicts = getConflicts(startTime, matchedEvent?.id);
  const bookingMode =
    action === "book_cab"
      ? "CAB"
      : action === "book_auto"
        ? "AUTO"
        : action === "book_metro"
          ? "METRO"
          : null;

  return {
    success: true,
    action,
    origin,
    destination,
    matchedEvent,
    eventDraft:
      action === "create_event"
        ? {
            id: `mock-event-${Date.now().toString().slice(-6)}`,
            title: inferEventTitle(options.message, destination, matchedEvent),
            location: destination,
            startTime: startTime.toISOString(),
            status: "Mock event created for testing only",
          }
        : null,
    recommendedMode: recommended,
    alternatives: estimates.slice(1),
    roadTrafficEstimate,
    leaveAt: formatTime(leaveAt),
    arrivalTarget: formatTime(startTime),
    bufferMinutes: BUFFER_MINUTES,
    conflicts,
    booking: bookingMode ? createMockBooking(bookingMode, destination) : null,
    bookingOffers: {
      cab: estimates.find(e => e.mode === "CAB")?.bookingUrl,
      auto: estimates.find(e => e.mode === "AUTO")?.bookingUrl,
      metro: estimates.find(e => e.mode === "METRO")?.bookingUrl,
      transit: estimates.find(e => e.mode === "TRANSIT")?.bookingUrl,
    },
    availableMockEvents: mockEvents,
  };
}
