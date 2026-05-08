export interface TravelEstimate {
  duration: string;
  distance: string;
  mode: string;
}

export async function getTravelEstimate(
  origin: string,
  destination: string
): Promise<TravelEstimate> {
  console.log(`Calculating travel estimate from ${origin} to ${destination}...`);

  return {
    duration: "52 mins",
    distance: "14 km",
    mode: "TRANSIT",
  };
}
