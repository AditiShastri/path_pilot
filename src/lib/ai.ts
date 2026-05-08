interface ReminderInput {
  title: string;
  startTime: string;
  travelDuration: string;
  distance?: string;
  trafficDelay?: string;
  noTrafficDuration?: string;
  liveTrafficDuration?: string;
  routeSource?: string;
  origin?: string;
  location: string;
  eventStartTime?: string;
  reminderWindowMinutes?: number;
}

export async function generateReminder(input: ReminderInput): Promise<string> {
  console.log("Generating AI reminder...");

  const origin = input.origin ?? "your saved home location";
  const routeSource =
    input.routeSource === "tomtom"
      ? "TomTom live traffic"
      : "the mock route estimator";
  const distance = input.distance ? ` The route distance is ${input.distance}.` : "";
  const traffic = input.trafficDelay
    ? ` Current traffic delay is ${input.trafficDelay}.`
    : "";
  const noTraffic = input.noTrafficDuration
    ? ` Without traffic, TomTom estimates ${input.noTrafficDuration}.`
    : "";
  const liveTraffic = input.liveTrafficDuration
    ? ` Live-traffic travel time is ${input.liveTrafficDuration}.`
    : "";

  if (input.reminderWindowMinutes !== undefined) {
    const startTime = input.eventStartTime ? ` at ${input.eventStartTime}` : "";
    return `Commute reminder: ${input.title} starts in about ${input.reminderWindowMinutes} minutes${startTime}. Destination: ${input.location}. Starting point: ${origin}. Based on ${routeSource}, travel time is approximately ${input.travelDuration}.${distance}${traffic}${noTraffic}${liveTraffic} Since the appointment is close, leave now if you are not already on the way.`;
  }

  return `Commute reminder: ${input.title} at ${input.location}. Starting point: ${origin}. Based on ${routeSource}, travel time is approximately ${input.travelDuration}.${distance}${traffic}${noTraffic}${liveTraffic} Leave early to avoid delays.`;
}
