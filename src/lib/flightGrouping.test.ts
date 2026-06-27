import { describe, it, expect } from "vitest";
import { Flight } from "@/types";
import { groupFlightsIntoJourneys } from "@/lib/flightGrouping";

function makeFlight(overrides: Partial<Flight>): Flight {
  return {
    id: Math.random().toString(36),
    created_at: "2026-01-01T00:00",
    origin_code: "DXB",
    origin_city: "Dubai",
    destination_code: "BLR",
    destination_city: "Bengaluru",
    departure_time: "2026-01-30T10:00",
    arrival_time: "2026-01-30T13:00",
    flight_number: "EK100",
    status: "completed",
    type: "past",
    ...overrides,
  };
}

describe("groupFlightsIntoJourneys", () => {
  it("groups a DXB round-trip into a single journey", () => {
    const out = makeFlight({ origin_code: "DXB", destination_code: "BLR", departure_time: "2026-01-30T03:40" });
    const back = makeFlight({ origin_code: "BLR", destination_code: "DXB", departure_time: "2026-01-30T10:25" });
    const journeys = groupFlightsIntoJourneys([out, back], true);
    expect(journeys).toHaveLength(1);
    expect(journeys[0]).toHaveLength(2);
  });

  it("splits separate round-trips into separate journeys", () => {
    const flights = [
      makeFlight({ origin_code: "DXB", destination_code: "BLR", departure_time: "2026-01-30T03:40" }),
      makeFlight({ origin_code: "BLR", destination_code: "DXB", departure_time: "2026-01-30T10:25" }),
      makeFlight({ origin_code: "DXB", destination_code: "VIE", departure_time: "2026-01-31T08:55" }),
      makeFlight({ origin_code: "VIE", destination_code: "DXB", departure_time: "2026-02-01T14:55" }),
    ];
    const journeys = groupFlightsIntoJourneys(flights, true);
    expect(journeys).toHaveLength(2);
    expect(journeys.every((j) => j.length === 2)).toBe(true);
  });

  it("keeps a multi-leg outbound chain together until it returns to the hub", () => {
    const flights = [
      makeFlight({ origin_code: "DXB", destination_code: "LUN", departure_time: "2026-02-14T09:15" }),
      makeFlight({ origin_code: "LUN", destination_code: "HRE", departure_time: "2026-02-14T15:55" }),
      makeFlight({ origin_code: "HRE", destination_code: "LUN", departure_time: "2026-02-15T18:45" }),
      makeFlight({ origin_code: "LUN", destination_code: "DXB", departure_time: "2026-02-15T21:20" }),
    ];
    const journeys = groupFlightsIntoJourneys(flights, true);
    expect(journeys).toHaveLength(1);
    expect(journeys[0]).toHaveLength(4);
  });

  it("orders newest-first when sortAscending is false", () => {
    const older = makeFlight({ origin_code: "DXB", destination_code: "BLR", departure_time: "2026-01-30T03:40" });
    const newer = makeFlight({ origin_code: "DXB", destination_code: "VIE", departure_time: "2026-03-30T03:40" });
    const journeys = groupFlightsIntoJourneys([older, newer], false);
    expect(journeys[0][0].destination_code).toBe("VIE");
  });
});
