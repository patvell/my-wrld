import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getFlightsByIdent, isAeroApiConfigured, AeroApiError } from "@/lib/aeroapi";

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

  it("throws AeroApiError on a non-200 response", async () => {
    vi.stubEnv("FLIGHTAWARE_API_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    await expect(getFlightsByIdent("UAE5")).rejects.toMatchObject({ status: 401 });
  });
});
