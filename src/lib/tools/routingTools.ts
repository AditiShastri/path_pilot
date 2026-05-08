import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { calculateTomTomRoute, geocodeTomTomAddress } from "@/lib/tomtom/routing";

type RoutingToolsOptions = {
  defaultOrigin?: { lat: number; lng: number } | null;
};

export function createRoutingTools(options?: RoutingToolsOptions) {
  const planRoute = tool({
    description:
      "Plan a route from the selected sidebar location (home/current/manual) to a destination address using TomTom geocoding + routing.",
    inputSchema: z.object({
      destinationAddress: z
        .string()
        .min(1)
        .describe("Destination address text (TomTom geocoding)"),
      travelMode: z
        .enum(["car", "truck", "pedestrian", "bicycle", "motorcycle", "bus"])
        .optional()
        .describe("Use 'bus' for public transit routing via TomTom"),
      routeType: z.enum(["fastest", "shortest", "eco"]).optional(),
      traffic: z.boolean().optional().describe("If true, include traffic in ETA when available"),
    }),
    execute: async ({ destinationAddress, travelMode, routeType, traffic }) => {
      const resolvedOrigin = options?.defaultOrigin ?? null;
      if (!resolvedOrigin) {
        throw new Error("Select a sidebar location (home/current/manual) before planning a route.");
      }

      const destinationGeo = await geocodeTomTomAddress(destinationAddress.trim());
      const resolvedDestination = destinationGeo.position;

      const route = await calculateTomTomRoute({
        origin: resolvedOrigin,
        destination: resolvedDestination,
        travelMode,
        routeType,
        traffic,
      });

      const distanceKm = route.summary.lengthInMeters / 1000;
      const travelMinutes = route.summary.travelTimeInSeconds / 60;
      const trafficDelayMinutes =
        typeof route.summary.trafficDelayInSeconds === "number"
          ? route.summary.trafficDelayInSeconds / 60
          : null;
      const { points: _points, ...routeWithoutPoints } = route;

      return {
        ...routeWithoutPoints,
        resolved: {
          origin: resolvedOrigin,
          destination: resolvedDestination,
          destinationAddress: destinationGeo.formattedAddress,
          usedDefaultOrigin: true,
        },
        derived: {
          distanceKm: Math.round(distanceKm * 10) / 10,
          travelMinutes: Math.round(travelMinutes),
          trafficDelayMinutes: trafficDelayMinutes == null ? null : Math.round(trafficDelayMinutes),
        },
      };
    },
  });

  return {
    plan_route: planRoute,
  };
}
