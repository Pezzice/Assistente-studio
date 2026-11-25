import { describe, expect, it } from "vitest";
import { defaultFilter, matchesFilter, parseIcs } from "./calendar";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:basket-1
DTSTART;TZID=Europe/Rome:20261103T191500
DTEND;TZID=Europe/Rome:20261103T204500
RRULE:FREQ=WEEKLY;BYDAY=TU
SUMMARY:Basket allenamenti U16
END:VEVENT
BEGIN:VEVENT
UID:basket-1
RECURRENCE-ID;TZID=Europe/Rome:20261208T191500
DTSTART;TZID=Europe/Rome:20261208T180000
DTEND;TZID=Europe/Rome:20261208T193000
SUMMARY:Basket allenamenti U16 (orario cambiato)
END:VEVENT
BEGIN:VEVENT
UID:volley-1
DTSTART;TZID=Europe/Rome:20261202T183000
DTEND;TZID=Europe/Rome:20261202T200000
SUMMARY:Volley U14 allenamenti
END:VEVENT
BEGIN:VEVENT
UID:parr-1
DTSTART;TZID=Europe/Rome:20261202T150000
DTEND;TZID=Europe/Rome:20261202T160000
SUMMARY:Parrucchiere Anthea mulier Claudia
DESCRIPTION:Portare Gabriele
END:VEVENT
BEGIN:VEVENT
UID:ponte-1
DTSTART;VALUE=DATE:20261207
DTEND;VALUE=DATE:20261208
SUMMARY:Ponte Sant'Ambrogio
END:VEVENT
END:VCALENDAR`;

const from = new Date("2026-11-30T00:00:00+01:00");
const to = new Date("2026-12-14T00:00:00+01:00");

describe("parseIcs", () => {
  const events = parseIcs(ICS, from, to);

  it("expands weekly recurrences inside the range and applies exceptions", () => {
    const basket = events.filter((e) => e.title.startsWith("Basket"));
    expect(basket.map((e) => e.start)).toEqual(["2026-12-01T18:15:00.000Z", "2026-12-08T17:00:00.000Z"]);
    expect(basket[1].title).toContain("orario cambiato");
  });

  it("keeps all-day events as dates", () => {
    const ponte = events.find((e) => e.title.startsWith("Ponte"))!;
    expect(ponte.allDay).toBe(true);
    expect(ponte.start).toBe("2026-12-07T00:00:00");
  });
});

describe("matchesFilter (Gabriele)", () => {
  const f = defaultFilter;
  it("includes basket and events naming Gabriele, excludes volley and the rest", () => {
    expect(matchesFilter({ title: "Basket allenamenti U16", description: "" }, f)).toBe(true);
    expect(matchesFilter({ title: "Partita Basket U17", description: "" }, f)).toBe(true);
    expect(matchesFilter({ title: "Gabriele mangia al Mc Donald's", description: "" }, f)).toBe(true);
    expect(matchesFilter({ title: "Parrucchiere Claudia", description: "Portare Gabriele" }, f)).toBe(true);
    expect(matchesFilter({ title: "Gabri: dentista", description: "" }, f)).toBe(true);
    expect(matchesFilter({ title: "Volley U14 allenamenti", description: "" }, f)).toBe(false);
    expect(matchesFilter({ title: "Yoga-Claudia", description: "" }, f)).toBe(false);
  });
});
