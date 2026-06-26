import { NextResponse } from "next/server";
import { z } from "zod";
import { getFlightsByIdent, isAeroApiConfigured, AeroApiError } from "@/lib/aeroapi";
import { mapAeroFlightToInput, pickFlightForDate } from "@/lib/aeroMapper";
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
    // Only treat as found when the schedule actually lands on the requested date.
    const found = Boolean(mapped && mapped.departure_time.slice(0, 10) === date);

    const result: LookupResult = found
      ? { configured: true, found: true, flight: mapped! }
      : { configured: true, found: false };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AeroApiError ? error.status ?? 502 : 502;
    console.error("AeroAPI lookup failed:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status });
  }
}
