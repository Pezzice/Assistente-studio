import { defaultFilter, matchesFilter, type CalendarFilter } from "./calendar";
import type { Commitment } from "./types";

/** Event as returned by the Google Calendar API / connector (recurrences already expanded). */
export type GoogleEvent = {
  summary?: string;
  description?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export type CalendarFile = { updatedAt: string; from: string; to: string; events: Commitment[] };

/** Keeps only Gabriele's events, with title and times only (no descriptions, no other people). */
export function toCalendarFile(
  events: GoogleEvent[],
  range: { from: string; to: string },
  now = new Date(),
  filter: CalendarFilter = defaultFilter,
): CalendarFile {
  const out: Commitment[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.status === "cancelled" || !e.start || !e.end) continue;
    const title = (e.summary ?? "").trim();
    if (!matchesFilter({ title, description: e.description ?? "" }, filter)) continue;
    const allDay = !e.start.dateTime;
    const c: Commitment = {
      title,
      allDay,
      start: allDay ? `${e.start.date}T00:00:00` : new Date(e.start.dateTime!).toISOString(),
      end: allDay ? `${e.end.date}T00:00:00` : new Date(e.end.dateTime!).toISOString(),
    };
    const key = `${c.title}|${c.start}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return { updatedAt: now.toISOString(), ...range, events: out };
}

/** Commitments in [from, to) from the synced file. */
export function commitmentsFromFile(file: CalendarFile, from: Date, to: Date): Commitment[] {
  return file.events.filter((e) => Date.parse(e.start) < to.getTime() && Date.parse(e.end) > from.getTime());
}
