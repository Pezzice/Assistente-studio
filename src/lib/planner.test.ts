import { describe, expect, it } from "vitest";
import { defaultSettings, planWeek, recentTopics, subjectStatuses, weightedAverage } from "./planner";
import { sampleData } from "./sample-data";
import { addDays, romeToIso, toMinutes } from "./dates";
import type { StudentData } from "./types";

const MON = "2026-11-30";

describe("weightedAverage", () => {
  it("weights grades and ignores empty input", () => {
    expect(weightedAverage([])).toBeNull();
    expect(
      weightedAverage([
        { subject: "M", value: 6, date: MON, weight: 1 },
        { subject: "M", value: 9, date: MON, weight: 2 },
      ]),
    ).toBe(8);
  });
});

describe("subjectStatuses", () => {
  it("computes gap to target and next test, case-insensitively", () => {
    const data: StudentData = {
      grades: [{ subject: "MATEMATICA", value: 6, date: MON, weight: 1 }],
      goals: [{ subject: "Matematica", target: 7 }],
      agenda: [{ id: "1", subject: "matematica", date: "2026-12-03", kind: "verifica", text: "" }],
      lessons: [],
      commitments: [],
    };
    const [m] = subjectStatuses(data, MON);
    expect(m.average).toBe(6);
    expect(m.gap).toBe(1);
    expect(m.nextTest?.date).toBe("2026-12-03");
  });
});

describe("planWeek with sample data", () => {
  const data = sampleData(MON);
  const plan = planWeek(data, MON, MON);
  const blocks = plan.days.flatMap((d) => d.blocks);

  it("prepares the maths test on days before it, spread out", () => {
    const maths = blocks.filter((b) => b.kind === "verifica" && b.subject === "Matematica");
    expect(maths.length).toBe(4);
    expect(maths.every((b) => b.date < "2026-12-03")).toBe(true);
    const perDay = new Map<string, number>();
    for (const b of maths) perDay.set(b.date, (perDay.get(b.date) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(defaultSettings.maxBlocksPerSubjectPerDay);
    expect(maths[0].topics).toContain("Metodo di riduzione e Cramer");
  });

  it("schedules homework before the due date", () => {
    const hw = blocks.filter((b) => b.kind === "compito");
    expect(hw.map((b) => b.subject).sort()).toEqual(["Fisica", "Lingua e letteratura italiana"]);
    for (const b of hw) expect(b.date < (b.subject === "Fisica" ? "2026-12-02" : "2026-12-04")).toBe(true);
  });

  it("starts preparing next week's oral test", () => {
    expect(blocks.some((b) => b.kind === "interrogazione" && b.subject === "Lingua e cultura latina")).toBe(true);
  });

  it("never overlaps commitments (with travel buffer) and respects windows and daily cap", () => {
    for (const day of plan.days) {
      const used = day.blocks.reduce((t, b) => t + toMinutes(b.end) - toMinutes(b.start), 0);
      expect(used).toBeLessThanOrEqual(defaultSettings.maxMinutesPerDay);
      for (const b of day.blocks) {
        for (const c of day.commitments.filter((c) => !c.allDay)) {
          const overlap =
            toMinutes(b.start) < toMinutes(c.end) + defaultSettings.bufferMinutes &&
            toMinutes(b.end) > toMinutes(c.start) - defaultSettings.bufferMinutes;
          expect(overlap, `${b.date} ${b.start} ${b.subject} vs ${c.title}`).toBe(false);
        }
      }
    }
    expect(plan.days[6].blocks).toHaveLength(0); // Sunday off
  });

  it("blocks within a day do not overlap", () => {
    for (const day of plan.days) {
      const sorted = [...day.blocks].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].start >= sorted[i - 1].end).toBe(true);
    }
  });

  it("adds recovery blocks for subjects below target", () => {
    expect(blocks.some((b) => b.kind === "recupero" && b.subject === "Lingua e cultura latina")).toBe(true);
  });
});

describe("planWeek edge cases", () => {
  it("does not plan days already past", () => {
    const plan = planWeek(sampleData(MON), MON, "2026-12-02");
    expect(plan.days.slice(0, 2).every((d) => d.blocks.length === 0)).toBe(true);
  });

  it("reports what does not fit", () => {
    const data = sampleData(MON);
    // a commitment covering the whole study window every day
    data.commitments = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(MON, i);
      return { title: "Impegno", start: romeToIso(date, "09:00"), end: romeToIso(date, "21:00"), allDay: false };
    });
    const plan = planWeek(data, MON, MON);
    expect(plan.days.flatMap((d) => d.blocks)).toHaveLength(0);
    expect(plan.unmet.some((u) => u.subject === "Matematica" && u.kind === "verifica")).toBe(true);
  });
});

describe("recentTopics", () => {
  it("takes topics since the last test", () => {
    const d = sampleData(MON);
    expect(recentTopics("Matematica", d.lessons, d.agenda, "2026-12-03")).toEqual([
      "Problemi con i sistemi",
      "Metodo di riduzione e Cramer",
      "Sistemi lineari: metodo di sostituzione",
    ]);
  });
});
