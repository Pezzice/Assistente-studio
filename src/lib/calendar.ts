import ICAL from "ical.js";
import type { Commitment } from "./types";

export type CalendarFilter = {
  /** Always included when found in title or description (e.g. the student's name) */
  alwaysInclude: string[];
  /** Included when found in the title, unless an exclude word matches */
  include: string[];
  exclude: string[];
};

/**
 * Default rule for the "Famiglia" calendar: events naming Gabriele, plus his basket
 * (U16/U17) team. Volley belongs to his sister.
 */
export const defaultFilter: CalendarFilter = {
  alwaysInclude: ["gabriele", "gabri:"],
  include: ["basket"],
  exclude: ["volley"],
};

export type RawEvent = Commitment & { description: string };

export function matchesFilter(ev: { title: string; description: string }, f: CalendarFilter): boolean {
  const title = ev.title.toLowerCase();
  const all = `${title}\n${ev.description.toLowerCase()}`;
  if (f.alwaysInclude.some((w) => all.includes(w.toLowerCase()))) return true;
  if (f.exclude.some((w) => title.includes(w.toLowerCase()))) return false;
  return f.include.some((w) => title.includes(w.toLowerCase()));
}

function toCommitment(summary: string, description: string, start: ICAL.Time, end: ICAL.Time): RawEvent {
  const allDay = start.isDate;
  return {
    title: summary.trim(),
    description,
    allDay,
    start: allDay ? `${start.toString()}T00:00:00` : start.toJSDate().toISOString(),
    end: allDay ? `${end.toString()}T00:00:00` : end.toJSDate().toISOString(),
  };
}

const ROME_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Rome
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

/** Registers the time zones declared in the feed, plus Europe/Rome as a fallback. */
function registerTimezones(root: ICAL.Component) {
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
  if (!ICAL.TimezoneService.has("Europe/Rome")) {
    ICAL.TimezoneService.register(new ICAL.Component(ICAL.parse(ROME_VTIMEZONE)));
  }
}

/** Parses an iCalendar text and returns the events overlapping [from, to), recurrences expanded. */
export function parseIcs(text: string, from: Date, to: Date): RawEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  registerTimezones(root);
  const vevents = root.getAllSubcomponents("vevent");

  // Group exceptions (RECURRENCE-ID) with their master event
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Component[] = [];
  for (const c of vevents) {
    if (c.hasProperty("recurrence-id")) exceptions.push(c);
    else masters.set(String(c.getFirstPropertyValue("uid")), new ICAL.Event(c));
  }
  for (const c of exceptions) {
    const master = masters.get(String(c.getFirstPropertyValue("uid")));
    if (master) master.relateException(c);
    else masters.set(`${c.getFirstPropertyValue("uid")}#${c.getFirstPropertyValue("recurrence-id")}`, new ICAL.Event(c));
  }

  const out: RawEvent[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const overlaps = (s: ICAL.Time, e: ICAL.Time) => s.toJSDate().getTime() < toMs && e.toJSDate().getTime() > fromMs;

  for (const ev of masters.values()) {
    if (String(ev.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") continue;
    if (!ev.isRecurring()) {
      if (overlaps(ev.startDate, ev.endDate)) out.push(toCommitment(ev.summary ?? "", ev.description ?? "", ev.startDate, ev.endDate));
      continue;
    }
    const it = ev.iterator();
    for (let next = it.next(), guard = 0; next && guard < 2000; next = it.next(), guard++) {
      if (next.toJSDate().getTime() >= toMs) break;
      const occ = ev.getOccurrenceDetails(next);
      if (String(occ.item.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") continue;
      if (overlaps(occ.startDate, occ.endDate)) {
        out.push(toCommitment(occ.item.summary ?? "", occ.item.description ?? "", occ.startDate, occ.endDate));
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export async function fetchFamilyCommitments(
  icsUrl: string,
  from: Date,
  to: Date,
  filter: CalendarFilter = defaultFilter,
): Promise<Commitment[]> {
  const res = await fetch(icsUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Calendario non raggiungibile (HTTP ${res.status})`);
  const events = parseIcs(await res.text(), from, to);
  return events.filter((e) => matchesFilter(e, filter)).map(({ description: _d, ...c }) => c);
}
