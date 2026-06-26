import { NextResponse } from "next/server";
import { z } from "zod";
import { getFlightsByIdent, isAeroApiConfigured, AeroApiError } from "@/lib/aeroapi";
import { mapAeroFlightToInput, pickFlightForDate, daySpan } from "@/lib/aeroMapper";
import { getCached, setCached, LOOKUP_TTL_MS } from "@/lib/aeroCache";
import { toAeroIdent } from "@/lib/config";
import { FlightInput } from "@/types";

const querySchema = z.object({
  ident: z.string().min(1).max(10),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});

interface LookupResult {
  configured: boolean;
  found: boolean;
  /** Whether the matched instance is actually on the requested date. */
  exact?: boolean;
  /** Calendar days arrival falls after departure (0 same day, 1 overnight). */
  day_span?: number;
  /**
   * The flight schedule (route + times). Its dates reflect the matched AeroAPI
   * instance, which may differ from the requested date; the client applies the
   * user's chosen departure date and derives the arrival date from `day_span`.
   */
  flight?: FlightInput;
}

export async function GET(request: Request) {
  if (!isAeroApiConfigured()) {
    return NextResponse.json({ configured: false, found: false } satisfies LookupResult);
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    ident: url.searchParams.get("ident") ?? "",
    date: url.searchParams.get("date") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid lookup", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const aeroIdent = toAeroIdent(parsed.data.ident);
  const date = parsed.data.date;
  const cacheKey = `lookup:${aeroIdent}:${date}`;

  try {
    const cached = await getCached<LookupResult>(cacheKey, LOOKUP_TTL_MS);
    if (cached) return NextResponse.json(cached);

    const flights = await getFlightsByIdent(aeroIdent);
    const match = pickFlightForDate(flights, date);
    const mapped = match ? mapAeroFlightToInput(match) : null;

    // Return any usable schedule (route + times), even if the matched instance
    // isn't on the requested date. This lets users look up flights booked far in
    // advance (beyond AeroAPI's ~2-week horizon) and apply their own date.
    const result: LookupResult = mapped
      ? {
          configured: true,
          found: true,
          exact: mapped.departure_time.slice(0, 10) === date,
          day_span: daySpan(mapped.departure_time, mapped.arrival_time),
          flight: mapped,
        }
      : { configured: true, found: false };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI lookup failed:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status });
  }
}
