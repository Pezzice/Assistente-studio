import { describe, expect, it } from "vitest";
import { adaptiveLoad, defaultSettings, normalizeSubject, planWeek, recentTopics, subjectStatuses, weightedAverage } from "./planner";
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
    expect(maths.length).toBe(5); // 3h + 45 min because maths is below target
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
      expect(used).toBeLessThanOrEqual(defaultSettings.maxMinutesPerDay[new Date(`${day.date}T00:00:00Z`).getUTCDay()]);
      const windows = defaultSettings.windows[new Date(`${day.date}T00:00:00Z`).getUTCDay()];
      for (const b of day.blocks) {
        expect(windows.some((w) => b.start >= w.start && b.end <= w.end), `${b.date} ${b.start}`).toBe(true);
      }
      for (const b of day.blocks) {
        for (const c of day.commitments.filter((c) => !c.allDay)) {
          const overlap =
            toMinutes(b.start) < toMinutes(c.end) + defaultSettings.bufferMinutes &&
            toMinutes(b.end) > toMinutes(c.start) - defaultSettings.bufferMinutes;
          expect(overlap, `${b.date} ${b.start} ${b.subject} vs ${c.title}`).toBe(false);
        }
      }
    }
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

describe("timetable", () => {
  it("starts studying after school, travel and lunch", () => {
    expect(defaultSettings.windows[1]).toEqual([{ start: "15:25", end: "19:30" }]); // Monday ends 13:55
    expect(defaultSettings.windows[2]).toEqual([{ start: "14:35", end: "19:30" }]); // Tuesday ends 13:05
    expect(defaultSettings.windows[6]).toEqual([{ start: "15:00", end: "17:00" }]); // Saturday morning: housework
  });

  it("matches ClasseViva names to short timetable names", () => {
    expect(normalizeSubject("LINGUA E CULTURA LATINA")).toBe(normalizeSubject("Latino"));
    expect(normalizeSubject("Disegno e storia dell'arte")).toBe("arte");
    expect(normalizeSubject("Scienze motorie e sportive")).toBe("motoria");
    expect(normalizeSubject("Storia e geografia")).toBe("storia");
  });

  it("puts recovery blocks on the day before a lesson of that subject when possible", () => {
    const data = sampleData(MON);
    data.agenda = [];
    data.commitments = [];
    const plan = planWeek(data, MON, MON);
    const latin = plan.days.flatMap((d) => d.blocks).filter((b) => b.subject === "Lingua e cultura latina");
    expect(latin.length).toBeGreaterThan(0);
    // Latin is on Tuesday and Thursday: study on Monday and Wednesday
    for (const b of latin) expect(["2026-11-30", "2026-12-02"]).toContain(b.date);
    expect(latin[0].reason).toContain("domani c'è lezione");
  });
});

describe("adaptive load", () => {
  const base = { subject: "Fisica", nextTest: null, newTopics: 0 };
  it("adds recovery after a fail and when grades fall, removes it when they rise", () => {
    const s = defaultSettings;
    expect(adaptiveLoad({ ...base, average: 6.8, target: 7, gap: 0.2, lastGrade: 7, trend: 0 }, s).recovery).toBe(1);
    expect(adaptiveLoad({ ...base, average: 7.2, target: 7, gap: 0, lastGrade: 5.5, trend: -1.5 }, s).recovery).toBe(2);
    expect(adaptiveLoad({ ...base, average: 6.8, target: 7, gap: 0.2, lastGrade: 7.5, trend: 1 }, s).recovery).toBe(0);
    expect(adaptiveLoad({ ...base, average: 8, target: 7, gap: 0, lastGrade: 8, trend: 0 }, s)).toMatchObject({
      recovery: 0,
      testMinutes: -45,
    });
  });

  it("keeps Sunday for deadlines only and adds review blocks for new topics", () => {
    const data = sampleData(MON);
    data.agenda = [];
    data.goals = [];
    data.lessons = ["2026-11-30", "2026-12-01", "2026-12-02"].map((date, i) => ({ subject: "Fisica", date, topic: `Argomento ${i}` }));
    const plan = planWeek(data, MON, "2026-12-03");
    const blocks = plan.days.flatMap((d) => d.blocks);
    expect(blocks.filter((b) => b.kind === "ripasso").map((b) => b.subject)).toEqual(["Fisica"]);
    expect(plan.days[6].blocks).toHaveLength(0);
  });
});

describe("homework", () => {
  it("is always scheduled first, even when the week is full of tests", () => {
    const data = sampleData(MON);
    data.commitments = [];
    for (let i = 0; i < 6; i++) {
      data.agenda.push({ id: `t${i}`, subject: ["Fisica", "Storia e geografia", "Scienze naturali"][i % 3], date: "2026-12-03", kind: "verifica", text: "" });
    }
    const plan = planWeek(data, MON, MON);
    const hw = plan.days.flatMap((d) => d.blocks).filter((b) => b.kind === "compito");
    expect(hw).toHaveLength(2);
    expect(plan.unmet.some((u) => u.kind === "compito")).toBe(false);
  });
});

describe("carry over", () => {
  it("reschedules work left from blocks not done", () => {
    const data = sampleData(MON);
    data.agenda = [];
    data.goals = [];
    data.carryOver = [{ subject: "Storia e geografia", minutes: 45, reason: "Da recuperare: non fatto lunedì 30 nov" }];
    const blocks = planWeek(data, MON, "2026-12-01").days.flatMap((d) => d.blocks);
    expect(blocks.filter((b) => b.reason.startsWith("Da recuperare")).map((b) => b.subject)).toEqual(["Storia e geografia"]);
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
