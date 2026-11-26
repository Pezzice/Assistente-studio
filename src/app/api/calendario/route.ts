import { NextResponse } from "next/server";
import calendarFile from "../../../../data/calendario.json";

export const dynamic = "force-dynamic";

/** Gabriele's synced commitments, for the Android app (protected by the family PIN). */
export function GET() {
  return NextResponse.json(calendarFile);
}
