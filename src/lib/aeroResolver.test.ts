import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as aeroapi from "@/lib/aeroapi";
import { resolveFlightLookup } from "@/lib/aeroResolver";

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe("resolveFlightLookup", () => {
  const today = "2026-06-26";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${today}T12:00:00Z`));
    vi.spyOn(aeroapi, "getFlightsByIdent");
    vi.spyOn(aeroapi, "getSchedules");
    vi.spyOn(aeroapi, "getHistoricalFlightsByIdent");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses operational endpoint for dates within the operational window", async () => {
    vi.mocked(aeroapi.getFlightsByIdent).mockResolvedValue([
      {
        ident: "UAE5",
        ident_iata: "EK5",
        fa_flight_id: "op-1",
        origin: { code_iata: "DXB", timezone: "Asia/Dubai", city: "Dubai" },
        destination: { code_iata: "LHR", timezone: "Europe/London", city: "London" },
        scheduled_out: "2026-06-26T10:45:00Z",
        scheduled_in: "2026-06-26T19:45:00Z",
      },
    ]);

    const result = await resolveFlightLookup("UAE5", today);
    expect(aeroapi.getFlightsByIdent).toHaveBeenCalledWith("UAE5", {
      start: today,
      end: addDays(today, 1),
    });
    expect(result.source).toBe("operational");
    expect(result.exact).toBe(true);
    expect(result.fa_flight_id).toBe("op-1");
  });

  it("uses schedules endpoint for far-future dates", async () => {
    const future = addDays(today, 30);
    vi.mocked(aeroapi.getSchedules).mockResolvedValue([
      {
        ident: "UAE5",
        ident_iata: "EK5",
        origin_iata: "DXB",
        destination_iata: "LHR",
        origin_timezone: "Asia/Dubai",
        destination_timezone: "Europe/London",
        scheduled_out: `${future}T10:45:00Z`,
        scheduled_in: `${future}T19:45:00Z`,
      },
    ]);

    const result = await resolveFlightLookup("UAE5", future);
    expect(aeroapi.getSchedules).toHaveBeenCalledWith(future, addDays(future, 1), {
      airline: "UAE",
      flight_number: "5",
    });
    expect(result.source).toBe("schedule");
    expect(aeroapi.getFlightsByIdent).not.toHaveBeenCalled();
  });

  it("uses history endpoint for old past dates outside schedule window", async () => {
    const oldDate = addDays(today, -120);
    vi.mocked(aeroapi.getHistoricalFlightsByIdent).mockResolvedValue([
      {
        ident: "UAE5",
        ident_iata: "EK5",
        fa_flight_id: "hist-1",
        origin: { code_iata: "DXB", timezone: "Asia/Dubai", city: "Dubai" },
        destination: { code_iata: "LHR", timezone: "Europe/London", city: "London" },
        scheduled_out: `${oldDate}T10:45:00Z`,
        scheduled_in: `${oldDate}T19:45:00Z`,
      },
    ]);

    const result = await resolveFlightLookup("UAE5", oldDate);
    expect(aeroapi.getHistoricalFlightsByIdent).toHaveBeenCalledWith("UAE5", {
      start: oldDate,
      end: addDays(oldDate, 1),
    });
    expect(result.source).toBe("history");
  });

  it("prefers history when preferHistory is set for past dates", async () => {
    const past = addDays(today, -5);
    vi.mocked(aeroapi.getHistoricalFlightsByIdent).mockResolvedValue([
      {
        ident: "UAE5",
        ident_iata: "EK5",
        fa_flight_id: "hist-2",
        origin: { code_iata: "DXB", timezone: "Asia/Dubai", city: "Dubai" },
        destination: { code_iata: "LHR", timezone: "Europe/London", city: "London" },
        scheduled_out: `${past}T10:45:00Z`,
        scheduled_in: `${past}T19:45:00Z`,
      },
    ]);

    const result = await resolveFlightLookup("UAE5", past, { preferHistory: true });
    expect(aeroapi.getHistoricalFlightsByIdent).toHaveBeenCalled();
    expect(result.source).toBe("history");
  });

  it("falls back to template when no tier matches", async () => {
    const future = addDays(today, 30);
    vi.mocked(aeroapi.getSchedules).mockResolvedValue([]);
    vi.mocked(aeroapi.getFlightsByIdent).mockResolvedValue([
      {
        ident: "UAE5",
        ident_iata: "EK5",
        fa_flight_id: "tpl-1",
        origin: { code_iata: "DXB", timezone: "Asia/Dubai", city: "Dubai" },
        destination: { code_iata: "LHR", timezone: "Europe/London", city: "London" },
        scheduled_out: "2026-06-20T10:45:00Z",
        scheduled_in: "2026-06-20T19:45:00Z",
      },
    ]);

    const result = await resolveFlightLookup("UAE5", future);
    expect(result.source).toBe("template");
    expect(result.flight).not.toBeNull();
  });
});
