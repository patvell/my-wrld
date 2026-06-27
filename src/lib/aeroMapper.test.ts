import { describe, it, expect } from "vitest";
import type { AeroFlight } from "@/lib/aeroapi";
import { mapAeroFlightToInput, pickFlightForDate, mapAeroFlightToStatus, daySpan } from "@/lib/aeroMapper";

function aeroFlight(overrides: Partial<AeroFlight> = {}): AeroFlight {
  return {
    ident: "UAE5",
    ident_iata: "EK5",
    fa_flight_id: "UAE5-1700000000-airline-0",
    origin: { code_iata: "DXB", timezone: "Asia/Dubai", city: "Dubai" },
    destination: { code_iata: "LHR", timezone: "Europe/London", city: "London" },
    scheduled_out: "2026-04-20T10:45:00Z", // DXB +4 -> 14:45
    scheduled_in: "2026-04-20T19:45:00Z", // LHR BST +1 -> 20:45
    status: "Scheduled",
    progress_percent: 0,
    ...overrides,
  };
}

describe("mapAeroFlightToInput", () => {
  it("maps codes/cities and converts UTC times to each airport's local wall-clock", () => {
    const out = mapAeroFlightToInput(aeroFlight());
    expect(out).toEqual({
      origin_code: "DXB",
      origin_city: "Dubai",
      destination_code: "LHR",
      destination_city: "London",
      departure_time: "2026-04-20T14:45",
      arrival_time: "2026-04-20T20:45",
      flight_number: "EK5",
    });
  });

  it("prefers the AeroAPI-provided timezone over local airport data", () => {
    const out = mapAeroFlightToInput(
      aeroFlight({
        origin: { code_iata: "ZZZ", timezone: "America/New_York", city: "Nowhere" },
        scheduled_out: "2026-01-01T17:00:00Z", // EST -5 -> 12:00
      }),
    );
    expect(out?.departure_time).toBe("2026-01-01T12:00");
  });

  it("returns null when essential fields are missing", () => {
    expect(mapAeroFlightToInput(aeroFlight({ origin: null }))).toBeNull();
    expect(mapAeroFlightToInput(aeroFlight({ scheduled_out: null, estimated_out: null, actual_out: null, scheduled_off: null }))).toBeNull();
  });
});

describe("pickFlightForDate", () => {
  it("returns the flight whose local departure date matches", () => {
    const a = aeroFlight({ fa_flight_id: "a", scheduled_out: "2026-04-19T10:45:00Z" }); // 2026-04-19 local
    const b = aeroFlight({ fa_flight_id: "b", scheduled_out: "2026-04-20T10:45:00Z" }); // 2026-04-20 local
    expect(pickFlightForDate([a, b], "2026-04-20")?.fa_flight_id).toBe("b");
  });

  it("returns null for an empty list", () => {
    expect(pickFlightForDate([], "2026-04-20")).toBeNull();
  });
});

describe("daySpan", () => {
  it("is 0 for a same-day flight", () => {
    expect(daySpan("2026-06-26T15:25", "2026-06-26T20:15")).toBe(0);
  });
  it("is 1 for an overnight flight", () => {
    expect(daySpan("2026-06-26T22:15", "2026-06-27T06:25")).toBe(1);
  });
  it("ignores time/offset suffixes", () => {
    expect(daySpan("2026-06-26T22:15:00+00:00", "2026-06-28T06:25:00Z")).toBe(2);
  });
});

describe("mapAeroFlightToStatus", () => {
  it("extracts status, progress and converts delay seconds to minutes", () => {
    const s = mapAeroFlightToStatus(
      aeroFlight({ status: "En Route", progress_percent: 42, arrival_delay: 900, gate_destination: "A12" }),
    );
    expect(s.status).toBe("En Route");
    expect(s.progress_percent).toBe(42);
    expect(s.arrival_delay_min).toBe(15);
    expect(s.gate_destination).toBe("A12");
    expect(s.fa_flight_id).toBe("UAE5-1700000000-airline-0");
  });
});
