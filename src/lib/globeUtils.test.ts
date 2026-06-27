import { describe, it, expect } from "vitest";
import { Flight } from "@/types";
import { computeArrivalVisitCounts, isOnVisibleHemisphere } from "@/lib/globeUtils";

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

describe("computeArrivalVisitCounts", () => {
  const isPast = (f: Flight) => f.type === "past";

  it("counts arrivals at DXB including return-to-home legs", () => {
    const flights = [
      makeFlight({ origin_code: "BLR", destination_code: "DXB", type: "past" }),
      makeFlight({ origin_code: "VIE", destination_code: "DXB", type: "past" }),
      makeFlight({ origin_code: "DXB", destination_code: "BLR", type: "past" }),
    ];
    const counts = computeArrivalVisitCounts(flights, isPast);
    expect(counts.DXB).toBe(2);
    expect(counts.BLR).toBe(1);
  });

  it("counts only destination airports, not origins", () => {
    const flights = [
      makeFlight({ origin_code: "DXB", destination_code: "LHR", type: "past" }),
      makeFlight({ origin_code: "LHR", destination_code: "DXB", type: "past" }),
    ];
    const counts = computeArrivalVisitCounts(flights, isPast);
    expect(counts.LHR).toBe(1);
    expect(counts.DXB).toBe(1);
  });

  it("ignores upcoming flights", () => {
    const flights = [
      makeFlight({ origin_code: "JNB", destination_code: "DXB", type: "future" }),
      makeFlight({ origin_code: "BLR", destination_code: "DXB", type: "past" }),
    ];
    const counts = computeArrivalVisitCounts(flights, isPast);
    expect(counts.DXB).toBe(1);
  });
});

describe("isOnVisibleHemisphere", () => {
  it("shows points near the camera latitude/longitude", () => {
    expect(isOnVisibleHemisphere(25, 55, 25, 55)).toBe(true);
    expect(isOnVisibleHemisphere(30, 60, 25, 55)).toBe(true);
  });

  it("hides antipodal points", () => {
    expect(isOnVisibleHemisphere(-25, -125, 25, 55)).toBe(false);
  });
});
