import { Flight } from "@/types";
import { departureInstant } from "@/lib/time";
import { HOME_HUB_CODE } from "@/lib/config";

export function groupFlightsIntoJourneys(flights: Flight[], sortAscending: boolean = false): Flight[][] {
  // 1. Sort all flights chronologically (oldest to newest) to detect sequences
  // easily. Compare true departure instants (wall-clock + airport timezone),
  // not browser-local Date parsing.
  const chronological = [...flights].sort(
    (a, b) => departureInstant(a).getTime() - departureInstant(b).getTime()
  );

  const journeys: Flight[][] = [];
  let currentJourney: Flight[] = [];

  for (let i = 0; i < chronological.length; i++) {
    const flight = chronological[i];

    if (currentJourney.length === 0) {
      currentJourney.push(flight);
    } else {
      const lastFlight = currentJourney[currentJourney.length - 1];
      // Check if they are connected: Origin must match previous Destination
      const isConnectedByLocation = flight.origin_code === lastFlight.destination_code;

      const startedAtHub = currentJourney[0].origin_code === HOME_HUB_CODE;
      const endedAtHub = lastFlight.destination_code === HOME_HUB_CODE;

      // A journey groups together consecutive flights only if it started at the
      // home hub and hasn't yet returned to it.
      if (startedAtHub && !endedAtHub && isConnectedByLocation) {
        currentJourney.push(flight);
      } else {
        journeys.push(currentJourney);
        currentJourney = [flight];
      }
    }
  }

  if (currentJourney.length > 0) {
    journeys.push(currentJourney);
  }

  // 2. Adjust sorting based on desired output order
  if (sortAscending) {
    // Already chronological:
    // Outer array: Oldest journey first
    // Inner array: Oldest flight first
    return journeys;
  } else {
    // Reverse chronological (Newest to Oldest)
    // Outer array: Newest journey first
    // Inner array: Newest flight first
    journeys.reverse();
    journeys.forEach(journey => journey.reverse());
    return journeys;
  }
}
