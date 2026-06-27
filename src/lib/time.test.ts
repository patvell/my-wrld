import { describe, it, expect } from "vitest";
import { Flight } from "@/types";
import {
  normalizeWallClock,
  padTimeInput,
  buildWallClock,
  toInstant,
  instantToWallClock,
  isPast,
  isActive,
  isLayoverBetween,
  getCurrentLocation,
  formatLocalTime,
  formatLocalDate,
} from "@/lib/time";

function makeFlight(overrides: Partial<Flight>): Flight {
  return {
    id: "x",
    created_at: "2026-01-01T00:00",
    origin_code: "DXB",
    origin_city: "Dubai",
    destination_code: "BLR",
    destination_city: "Bengaluru",
    departure_time: "2026-01-30T10:00",
    arrival_time: "2026-01-30T13:00",
    flight_number: "EK100",
    status: "scheduled",
    type: "future",
    ...overrides,
  };
}

describe("normalizeWallClock", () => {
  it("strips offsets and seconds", () => {
    expect(normalizeWallClock("2026-01-30T03:40:00+00:00")).toBe("2026-01-30T03:40");
    expect(normalizeWallClock("2026-01-30T03:40:00Z")).toBe("2026-01-30T03:40");
    expect(normalizeWallClock("2026-01-30T03:40")).toBe("2026-01-30T03:40");
  });

  it("handles a space separator", () => {
    expect(normalizeWallClock("2026-01-30 03:40:00")).toBe("2026-01-30T03:40");
  });

  it("pads single-digit hours and minutes", () => {
    expect(normalizeWallClock("2026-05-09T9:30")).toBe("2026-05-09T09:30");
  });
});

describe("padTimeInput", () => {
  it("left-pads hours and minutes to two digits", () => {
    expect(padTimeInput("9:30")).toBe("09:30");
    expect(padTimeInput("14:5")).toBe("14:05");
    expect(padTimeInput("09:30")).toBe("09:30");
  });
});

describe("buildWallClock", () => {
  it("combines date and padded time", () => {
    expect(buildWallClock("2026-05-09", "9:30")).toBe("2026-05-09T09:30");
  });
});

describe("toInstant", () => {
  it("converts a Dubai (+4, no DST) wall-clock to UTC", () => {
    expect(toInstant("2026-01-30T03:40", "DXB").toISOString()).toBe("2026-01-29T23:40:00.000Z");
  });

  it("respects DST for Europe/London", () => {
    // January: GMT (UTC+0)
    expect(toInstant("2026-01-01T12:00", "LHR").toISOString()).toBe("2026-01-01T12:00:00.000Z");
    // July: BST (UTC+1)
    expect(toInstant("2026-07-01T12:00", "LHR").toISOString()).toBe("2026-07-01T11:00:00.000Z");
  });

  it("handles half-hour offsets (Asia/Kolkata +5:30)", () => {
    expect(toInstant("2026-01-30T08:50", "BLR").toISOString()).toBe("2026-01-30T03:20:00.000Z");
  });
});

describe("instantToWallClock", () => {
  it("converts a UTC instant to the airport's local wall-clock", () => {
    expect(instantToWallClock("2026-01-29T23:40:00Z", "DXB")).toBe("2026-01-30T03:40");
    expect(instantToWallClock("2026-07-01T11:00:00Z", "LHR")).toBe("2026-07-01T12:00");
  });

  it("round-trips with toInstant across DST", () => {
    for (const [wc, code] of [
      ["2026-01-01T12:00", "LHR"],
      ["2026-07-01T12:00", "LHR"],
      ["2026-03-30T08:50", "BLR"],
    ] as const) {
      expect(instantToWallClock(toInstant(wc, code).toISOString(), code)).toBe(wc);
    }
  });
});

describe("isPast", () => {
  const flight = makeFlight({ destination_code: "DXB", destination_city: "Dubai" }); // arr 13:00 DXB -> 09:00Z, +2h -> 11:00Z

  it("is past only after 2h past arrival", () => {
    expect(isPast(flight, new Date("2026-01-30T10:00:00Z"))).toBe(false); // 1h after arrival
    expect(isPast(flight, new Date("2026-01-30T12:00:00Z"))).toBe(true); // 3h after arrival
  });
});

describe("isActive", () => {
  const flight = makeFlight({ destination_code: "DXB", destination_city: "Dubai" }); // dep 06:00Z, arr 09:00Z -> window 03:00Z..11:00Z

  it("is active inside the live window", () => {
    expect(isActive(flight, new Date("2026-01-30T07:00:00Z"))).toBe(true);
  });
  it("is inactive before and after the window", () => {
    expect(isActive(flight, new Date("2026-01-30T02:00:00Z"))).toBe(false);
    expect(isActive(flight, new Date("2026-01-30T12:00:00Z"))).toBe(false);
  });
});

describe("isLayoverBetween", () => {
  const leg1 = makeFlight({ id: "a", arrival_time: "2026-01-30T08:50" }); // arr BLR
  it("treats a short connection as a return (not a layover)", () => {
    const leg2 = makeFlight({ id: "b", origin_code: "BLR", destination_code: "DXB", departure_time: "2026-01-30T10:25" });
    expect(isLayoverBetween(leg1, leg2)).toBe(false);
  });
  it("treats a >12h gap as a layover", () => {
    const leg2 = makeFlight({ id: "b", origin_code: "BLR", destination_code: "DXB", departure_time: "2026-01-31T10:25" });
    expect(isLayoverBetween(leg1, leg2)).toBe(true);
  });
});

describe("getCurrentLocation", () => {
  it("falls back to the hub when there are no flights", () => {
    expect(getCurrentLocation([], new Date("2026-01-30T00:00:00Z")).code).toBe("DXB");
  });

  it("returns the origin while a flight is mid-air", () => {
    const flight = makeFlight({}); // dep 06:00Z arr 09:00Z
    const loc = getCurrentLocation([flight], new Date("2026-01-30T07:00:00Z"));
    expect(loc.code).toBe("DXB");
  });

  it("returns the destination of the most recently completed flight", () => {
    const flight = makeFlight({}); // arr 09:00Z
    const loc = getCurrentLocation([flight], new Date("2026-02-01T00:00:00Z"));
    expect(loc.code).toBe("BLR");
  });
});

describe("formatters", () => {
  it("formats time exactly as entered (no tz shift)", () => {
    expect(formatLocalTime("2026-01-30T03:40")).toBe("03:40");
    expect(formatLocalTime("2026-01-30T03:40:00+00:00")).toBe("03:40");
  });
  it("formats date exactly as entered", () => {
    expect(formatLocalDate("2026-01-30T03:40")).toBe("JAN 30 2026");
  });
});
