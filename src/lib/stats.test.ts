import { describe, it, expect } from "vitest";
import { Flight } from "@/types";
import {
  availableYears,
  computeTravelStats,
  groupJourneysByMonth,
  nextCountdown,
  formatCountdown,
  formatDistanceKm,
} from "@/lib/stats";

function makeFlight(overrides: Partial<Flight>): Flight {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: "2026-01-01T00:00",
    origin_code: "DXB",
    origin_city: "Dubai",
    destination_code: "BLR",
    destination_city: "Bengaluru",
    departure_time: "2026-01-30T10:00",
    arrival_time: "2026-01-30T15:00",
    flight_number: "EK100",
    status: "completed",
    type: "past",
    ...overrides,
  };
}

const outbound = makeFlight({}); // DXB -> BLR
const inbound = makeFlight({
  origin_code: "BLR",
  origin_city: "Bengaluru",
  destination_code: "DXB",
  destination_city: "Dubai",
  departure_time: "2026-01-31T10:00",
  arrival_time: "2026-01-31T13:00",
});
const toToronto2025 = makeFlight({
  destination_code: "YYZ",
  destination_city: "Toronto",
  departure_time: "2025-06-10T08:00",
  arrival_time: "2025-06-10T16:00",
});

describe("availableYears", () => {
  it("returns distinct years newest first", () => {
    expect(availableYears([outbound, inbound, toToronto2025])).toEqual([2026, 2025]);
  });
});

describe("computeTravelStats", () => {
  it("counts flights, visited places, hours, and distance", () => {
    const stats = computeTravelStats([outbound, inbound]);
    expect(stats.flights).toBe(2);
    expect(stats.airports).toBe(1); // BLR only — home hub excluded
    expect(stats.cities).toBe(1);
    expect(stats.countries).toBe(1); // IN
    // DXB->BLR is 5h wall minus 1.5h tz shift = 3.5h; BLR->DXB 3h + 1.5h = 4.5h
    expect(stats.hoursInAir).toBe(8);
    expect(stats.distanceKm).toBeGreaterThan(4000); // ~2x ~2700km
    expect(stats.mostVisitedCity).toBe("Bengaluru");
  });

  it("tracks the longest flight with its route", () => {
    const stats = computeTravelStats([outbound, toToronto2025]);
    expect(stats.longestFlightRoute).toBe("DXB → YYZ");
    expect(stats.longestFlightKm).toBeGreaterThan(10000);
  });

  it("filters by year when given one", () => {
    const stats = computeTravelStats([outbound, inbound, toToronto2025], 2025);
    expect(stats.flights).toBe(1);
    expect(stats.mostVisitedCity).toBe("Toronto");
  });
});

describe("groupJourneysByMonth", () => {
  it("groups consecutive journeys by the first flight's month", () => {
    const may = makeFlight({ departure_time: "2026-05-09T10:00", arrival_time: "2026-05-09T16:00" });
    const groups = groupJourneysByMonth([[may], [outbound, inbound], [toToronto2025]]);
    expect(groups.map((g) => g.key)).toEqual(["2026-05", "2026-01", "2025-06"]);
    expect(groups[0].label).toBe("MAY 2026");
    expect(groups[1].journeys).toHaveLength(1);
    expect(groups[1].journeys[0]).toHaveLength(2);
  });
});

describe("nextCountdown", () => {
  const now = new Date("2026-01-29T00:00:00Z");

  it("counts down to the arrival home when it is the next event", () => {
    // Inbound is in the air (departed BLR 04:30Z, lands DXB 09:00Z); the
    // landing home is the next event.
    const inAir = new Date("2026-01-31T05:00:00Z");
    const cd = nextCountdown([makeFlight({ status: "scheduled" }), { ...inbound, status: "scheduled" }], inAir);
    expect(cd?.kind).toBe("landing-home");
    expect(cd?.code).toBe("DXB");
  });

  it("prefers a sooner departure over a later arrival home", () => {
    // Both legs booked: outbound departs Jan 30, inbound lands home Jan 31.
    const cd = nextCountdown([makeFlight({ status: "scheduled" }), { ...inbound, status: "scheduled" }], now);
    expect(cd?.kind).toBe("next-journey");
    expect(cd?.code).toBe("BLR");
  });

  it("counts down to the next departure when no home arrival is booked", () => {
    const cd = nextCountdown([makeFlight({ status: "scheduled" })], now);
    expect(cd?.kind).toBe("next-journey");
    expect(cd?.code).toBe("BLR");
  });

  it("returns null with nothing upcoming", () => {
    expect(nextCountdown([outbound], new Date("2026-06-01T00:00:00Z"))).toBeNull();
  });
});

describe("format helpers", () => {
  it("formats countdown spans", () => {
    expect(formatCountdown(2 * 86_400_000 + 14 * 3_600_000)).toBe("2D 14H");
    expect(formatCountdown(14 * 3_600_000 + 5 * 60_000)).toBe("14H 05M");
    expect(formatCountdown(23 * 60_000)).toBe("23M");
  });

  it("formats distances", () => {
    expect(formatDistanceKm(1234)).toBe("1,234 KM");
    expect(formatDistanceKm(12_400)).toBe("12.4K KM");
  });
});
