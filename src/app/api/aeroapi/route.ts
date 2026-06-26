import { NextResponse } from "next/server";
import { isAeroApiConfigured } from "@/lib/aeroapi";

/** Lightweight probe so the UI can show/hide AeroAPI-powered affordances. */
export async function GET() {
  return NextResponse.json({ configured: isAeroApiConfigured() });
}
