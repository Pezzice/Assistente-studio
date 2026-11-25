import { describe, expect, it } from "vitest";
import { commitmentsFromFile, toCalendarFile } from "./calendar-file";

describe("toCalendarFile", () => {
  const file = toCalendarFile(
    [
      { summary: "Basket allenamenti U16", start: { dateTime: "2026-12-01T19:15:00+01:00" }, end: { dateTime: "2026-12-01T20:45:00+01:00" } },
      { summary: "Volley U14 allenamenti", start: { dateTime: "2026-12-01T18:00:00+01:00" }, end: { dateTime: "2026-12-01T19:30:00+01:00" } },
      { summary: "Parrucchiere Claudia", description: "Portare Gabriele", start: { dateTime: "2026-12-02T15:00:00+01:00" }, end: { dateTime: "2026-12-02T16:00:00+01:00" } },
      { summary: "Basket annullato", status: "cancelled", start: { dateTime: "2026-12-03T18:00:00+01:00" }, end: { dateTime: "2026-12-03T19:00:00+01:00" } },
    ],
    { from: "2026-11-30", to: "2026-12-21" },
    new Date("2026-11-25T20:00:00Z"),
  );

  it("keeps only Gabriele's events, without descriptions", () => {
    expect(file.events.map((e) => e.title)).toEqual(["Basket allenamenti U16", "Parrucchiere Claudia"]);
    expect(JSON.stringify(file)).not.toContain("Portare");
    expect(file.events[0].start).toBe("2026-12-01T18:15:00.000Z");
  });

  it("selects events in a range", () => {
    const week = commitmentsFromFile(file, new Date("2026-12-02T00:00:00+01:00"), new Date("2026-12-09T00:00:00+01:00"));
    expect(week.map((e) => e.title)).toEqual(["Parrucchiere Claudia"]);
  });
});
