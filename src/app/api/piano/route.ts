import { NextResponse } from "next/server";
import { loadData } from "@/lib/data";
import { planWeek } from "@/lib/planner";
import { resolveWeek } from "@/lib/week";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { today, weekStart } = resolveWeek(new URL(req.url).searchParams.get("settimana") ?? undefined);
  const data = await loadData(weekStart);
  const plan = planWeek(data, weekStart, today);
  return NextResponse.json({ ...plan, sources: data.sources, errors: data.errors });
}
