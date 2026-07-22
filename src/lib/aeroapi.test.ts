import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getFlightsByIdent,
  getFlightByFaId,
  getHistoricalFlightsByIdent,
  getSchedules,
  getFlightsBetweenAirports,
  isAeroApiConfigured,
  AeroApiError,
} from "@/lib/aeroapi";

describe("aeroapi client", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports configured based on the env var", () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "");
    expect(isAeroApiConfigured()).toBe(false);
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    expect(isAeroApiConfigured()).toBe(true);
  });

  it("throws AeroApiError when not configured", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "");
    await expect(getFlightsByIdent("UAE5")).rejects.toBeInstanceOf(AeroApiError);
  });

  it("sends the x-apikey header and max_pages=1, returning flights", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => {
      const u = new URL(String(url));
      expect(u.searchParams.get("max_pages")).toBe("1");
      expect((init?.headers as Record<string, string>)["x-apikey"]).toBe("secret");
      return new Response(JSON.stringify({ flights: [{ ident: "UAE5", fa_flight_id: "x" }] }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const flights = await getFlightsByIdent("UAE5");
    expect(flights).toHaveLength(1);
    expect(flights[0].fa_flight_id).toBe("x");
  });

  it("passes start, end, and ident_type query params", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    const fetchMock = vi.fn(async (url: URL | string) => {
      const u = new URL(String(url));
      expect(u.pathname).toContain("/flights/UAE5");
      expect(u.searchParams.get("start")).toBe("2026-06-26");
      expect(u.searchParams.get("end")).toBe("2026-06-27");
      expect(u.searchParams.get("ident_type")).toBe("fa_flight_id");
      return new Response(JSON.stringify({ flights: [] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getFlightsByIdent("UAE5", {
      start: "2026-06-26",
      end: "2026-06-27",
      ident_type: "fa_flight_id",
    });
  });

  it("throws AeroApiError on a non-200 response", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    await expect(getFlightsByIdent("UAE5")).rejects.toMatchObject({ status: 401 });
  });

  it("getFlightByFaId fetches by fa_flight_id ident_type", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    const fetchMock = vi.fn(async (url: URL | string) => {
      const u = new URL(String(url));
      expect(u.searchParams.get("ident_type")).toBe("fa_flight_id");
      return new Response(
        JSON.stringify({ flights: [{ ident: "UAE5", fa_flight_id: "fa-123" }] }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const flight = await getFlightByFaId("fa-123");
    expect(flight?.fa_flight_id).toBe("fa-123");
  });

  it("getHistoricalFlightsByIdent calls history endpoint", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    const fetchMock = vi.fn(async (url: URL | string) => {
      const u = new URL(String(url));
      expect(u.pathname).toContain("/history/flights/UAE5");
      expect(u.searchParams.get("start")).toBe("2025-01-01");
      expect(u.searchParams.get("end")).toBe("2025-01-02");
      return new Response(JSON.stringify({ flights: [{ ident: "UAE5", fa_flight_id: "h1" }] }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const flights = await getHistoricalFlightsByIdent("UAE5", {
      start: "2025-01-01",
      end: "2025-01-02",
    });
    expect(flights).toHaveLength(1);
  });

  it("getSchedules normalizes scheduled rows", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    const fetchMock = vi.fn(async (url: URL | string) => {
      const u = new URL(String(url));
      expect(u.pathname).toContain("/schedules/2026-07-01/2026-07-02");
      expect(u.searchParams.get("airline")).toBe("UAE");
      expect(u.searchParams.get("flight_number")).toBe("5");
      return new Response(
        JSON.stringify({
          scheduled: [
            {
              ident: "UAE5",
              ident_iata: "EK5",
              origin: { code_iata: "DXB", timezone: "Asia/Dubai" },
              destination: { code_iata: "LHR", timezone: "Europe/London" },
              scheduled_out: "2026-07-01T10:45:00Z",
              scheduled_in: "2026-07-01T19:45:00Z",
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const schedules = await getSchedules("2026-07-01", "2026-07-02", {
      airline: "UAE",
      flight_number: "5",
    });
    expect(schedules).toHaveLength(1);
    expect(schedules[0].origin_iata).toBe("DXB");
    expect(schedules[0].destination_iata).toBe("LHR");
  });

  it("getSchedules accepts top-level IATA strings from AeroAPI", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            scheduled: [
              {
                ident: "GIA8887",
                ident_iata: "GA8887",
                actual_ident: "UAE1",
                actual_ident_iata: "EK1",
                origin: "OMDB",
                destination: "EGLL",
                origin_iata: "DXB",
                destination_iata: "LHR",
                scheduled_out: "2026-07-23T03:35:00Z",
                scheduled_in: "2026-07-23T11:25:00Z",
              },
              {
                ident: "UAE1",
                ident_iata: "EK1",
                origin: "OMDB",
                destination: "EGLL",
                origin_iata: "DXB",
                destination_iata: "LHR",
                scheduled_out: "2026-07-23T03:35:00Z",
                scheduled_in: "2026-07-23T11:25:00Z",
              },
              {
                ident: "UAE29",
                ident_iata: "EK29",
                origin: "OMDB",
                destination: "EGLL",
                origin_iata: "DXB",
                destination_iata: "LHR",
                scheduled_out: "2026-07-23T05:35:00Z",
                scheduled_in: "2026-07-23T13:25:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const schedules = await getSchedules("2026-07-23", "2026-07-24", { airline: "UAE" });
    // Codeshare GIA8887 dropped; native UAE1 + UAE29 kept.
    expect(schedules).toHaveLength(2);
    expect(schedules.map((s) => s.ident_iata)).toEqual(["EK1", "EK29"]);
    expect(schedules[0].origin_iata).toBe("DXB");
  });

  it("getFlightsBetweenAirports flattens FindFlight segments", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    const fetchMock = vi.fn(async (url: URL | string) => {
      const u = new URL(String(url));
      expect(u.searchParams.get("airline")).toBeNull();
      return new Response(
        JSON.stringify({
          flights: [
            {
              segments: [
                {
                  ident: "UAE7",
                  ident_iata: "EK7",
                  fa_flight_id: "x",
                  origin: { code_iata: "DXB" },
                  destination: { code_iata: "LHR" },
                  scheduled_out: "2026-07-23T22:30:00Z",
                  scheduled_in: "2026-07-24T06:05:00Z",
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const flights = await getFlightsBetweenAirports("DXB", "LHR", {
      start: "2026-07-23",
      end: "2026-07-24",
    });
    expect(flights).toHaveLength(1);
    expect(flights[0].ident_iata).toBe("EK7");
  });
});
