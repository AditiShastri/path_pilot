import { mockEvents } from "@/lib/mock-events";

type TravelMode = "METRO" | "CAB" | "AUTO" | "TRANSIT";

interface ModeEstimate {
  mode: TravelMode;
  durationMinutes: number;
  duration: string;
  distance: string;
  cost: string;
  notes: string;
  score: number;
}

interface CommutePlanOptions {
  message: string;
  destination?: string;
  origin?: string;
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

function getMockModeEstimates(destination: string): ModeEstimate[] {
  const normalizedDestination = normalize(destination);

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
      },
      {
        mode: "CAB",
        durationMinutes: 44,
        duration: "44 mins",
        distance: "14 km",
        cost: "Rs. 420",
        notes: "Door-to-door, but traffic around MG Road can be slow.",
        score: 78,
      },
      {
        mode: "AUTO",
        durationMinutes: 49,
        duration: "49 mins",
        distance: "14 km",
        cost: "Rs. 260",
        notes: "Flexible, but less comfortable for longer stretches.",
        score: 72,
      },
      {
        mode: "TRANSIT",
        durationMinutes: 52,
        duration: "52 mins",
        distance: "14 km",
        cost: "Rs. 90",
        notes: "Budget option with more waiting time.",
        score: 66,
      },
    ];
  }

  if (normalizedDestination.includes("electronic city")) {
    return [
      {
        mode: "CAB",
        durationMinutes: 58,
        duration: "58 mins",
        distance: "25 km",
        cost: "Rs. 680",
        notes: "Best door-to-door option for Electronic City in this mock setup.",
        score: 88,
      },
      {
        mode: "AUTO",
        durationMinutes: 72,
        duration: "1 hr 12 mins",
        distance: "25 km",
        cost: "Rs. 430",
        notes: "Possible, but a long auto ride.",
        score: 62,
      },
      {
        mode: "TRANSIT",
        durationMinutes: 86,
        duration: "1 hr 26 mins",
        distance: "27 km",
        cost: "Rs. 120",
        notes: "Cheapest, but slowest and transfer-heavy.",
        score: 58,
      },
      {
        mode: "METRO",
        durationMinutes: 95,
        duration: "1 hr 35 mins",
        distance: "28 km",
        cost: "Rs. 80",
        notes: "Not ideal in this mock route because the last-mile leg is long.",
        score: 54,
      },
    ];
  }

  return [
    {
      mode: "CAB",
      durationMinutes: 45,
      duration: "45 mins",
      distance: "14 km",
      cost: "Rs. 400",
      notes: "Generic mock cab estimate for unknown destinations.",
      score: 80,
    },
    {
      mode: "AUTO",
      durationMinutes: 52,
      duration: "52 mins",
      distance: "14 km",
      cost: "Rs. 250",
      notes: "Generic mock auto estimate for unknown destinations.",
      score: 70,
    },
    {
      mode: "METRO",
      durationMinutes: 55,
      duration: "55 mins",
      distance: "15 km",
      cost: "Rs. 70",
      notes: "Generic mock metro estimate; station access may vary.",
      score: 68,
    },
    {
      mode: "TRANSIT",
      durationMinutes: 60,
      duration: "1 hr",
      distance: "14 km",
      cost: "Rs. 90",
      notes: "Generic public transit estimate.",
      score: 60,
    },
  ];
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

export function buildCommutePlan(options: CommutePlanOptions) {
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

  const matchedEvent = findMatchingEvent(options.message, destination);
  const estimates = getMockModeEstimates(destination).sort((a, b) => b.score - a.score);
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
    origin: options.origin || DEFAULT_ORIGIN,
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
    leaveAt: formatTime(leaveAt),
    arrivalTarget: formatTime(startTime),
    bufferMinutes: BUFFER_MINUTES,
    conflicts,
    booking: bookingMode ? createMockBooking(bookingMode, destination) : null,
    availableMockEvents: mockEvents,
  };
}
