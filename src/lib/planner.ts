import { addDays, dayLabel, daysBetween, romeParts, toHHMM, toMinutes, weekday } from "./dates";
import type {
  AgendaItem,
  BlockKind,
  DayPlan,
  Grade,
  Lesson,
  PlannerSettings,
  StudentData,
  StudyBlock,
  SubjectStatus,
  WeekPlan,
} from "./types";

export const defaultSettings: PlannerSettings = {
  windows: [
    null, // domenica libera
    { start: "15:00", end: "19:30" },
    { start: "15:00", end: "19:30" },
    { start: "15:00", end: "19:30" },
    { start: "15:00", end: "19:30" },
    { start: "15:00", end: "19:30" },
    { start: "10:00", end: "12:30" },
  ],
  maxMinutesPerDay: 180,
  blockMinutes: 45,
  breakMinutes: 15,
  bufferMinutes: 30,
  minutesPerTest: 180,
  minutesPerOralTest: 135,
  minutesPerHomework: 45,
  prepDays: 4,
  maxBlocksPerSubjectPerDay: 2,
};

type Interval = { start: number; end: number };

type Demand = {
  subject: string;
  kind: BlockKind;
  minutes: number;
  /** Blocks must be on days strictly before this date (inclusive end for "recupero") */
  deadline: string;
  earliest: string;
  reason: string;
  priority: number;
};

export function normalizeSubject(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function weightedAverage(grades: Grade[]): number | null {
  const valid = grades.filter((g) => Number.isFinite(g.value) && g.weight > 0);
  if (valid.length === 0) return null;
  const total = valid.reduce((s, g) => s + g.value * g.weight, 0);
  const w = valid.reduce((s, g) => s + g.weight, 0);
  return Math.round((total / w) * 100) / 100;
}

export function subjectStatuses(data: StudentData, today: string): SubjectStatus[] {
  const names = new Map<string, string>();
  for (const x of [...data.goals, ...data.grades, ...data.agenda]) {
    const key = normalizeSubject(x.subject);
    if (key && !names.has(key)) names.set(key, x.subject);
  }
  return [...names.entries()]
    .map(([key, subject]) => {
      const average = weightedAverage(data.grades.filter((g) => normalizeSubject(g.subject) === key));
      const goal = data.goals.find((g) => normalizeSubject(g.subject) === key);
      const target = goal ? goal.target : null;
      const gap = average !== null && target !== null ? Math.max(0, Math.round((target - average) * 100) / 100) : 0;
      const nextTest =
        data.agenda
          .filter(
            (a) =>
              normalizeSubject(a.subject) === key &&
              (a.kind === "verifica" || a.kind === "interrogazione") &&
              a.date >= today,
          )
          .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
      return { subject, average, target, gap, nextTest };
    })
    .sort((a, b) => b.gap - a.gap || a.subject.localeCompare(b.subject));
}

/** Topics covered in class since the last past test of the subject (max 6, newest first). */
export function recentTopics(subject: string, lessons: Lesson[], agenda: AgendaItem[], before: string): string[] {
  const key = normalizeSubject(subject);
  const lastTest = agenda
    .filter(
      (a) =>
        normalizeSubject(a.subject) === key &&
        (a.kind === "verifica" || a.kind === "interrogazione") &&
        a.date < before,
    )
    .map((a) => a.date)
    .sort()
    .at(-1);
  const since = lastTest ?? addDays(before, -21);
  const topics: string[] = [];
  for (const l of [...lessons].sort((a, b) => b.date.localeCompare(a.date))) {
    if (normalizeSubject(l.subject) !== key || l.date < since || l.date >= before) continue;
    const t = l.topic.trim();
    if (t && !topics.includes(t)) topics.push(t);
    if (topics.length >= 6) break;
  }
  return topics;
}

function subtract(intervals: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const iv of intervals) {
    if (cut.end <= iv.start || cut.start >= iv.end) {
      out.push(iv);
      continue;
    }
    if (cut.start > iv.start) out.push({ start: iv.start, end: cut.start });
    if (cut.end < iv.end) out.push({ start: cut.end, end: iv.end });
  }
  return out;
}

function commitmentsByDay(data: StudentData, days: string[]) {
  const byDay = new Map<string, DayPlan["commitments"]>(days.map((d) => [d, []]));
  const busy = new Map<string, Interval[]>(days.map((d) => [d, []]));
  for (const c of data.commitments) {
    if (c.allDay) {
      const startDate = c.start.slice(0, 10);
      const endDate = c.end.slice(0, 10); // exclusive
      for (const d of days) {
        if (d >= startDate && d < (endDate > startDate ? endDate : addDays(startDate, 1))) {
          byDay.get(d)!.push({ title: c.title, start: "", end: "", allDay: true });
        }
      }
      continue;
    }
    const s = romeParts(new Date(c.start));
    const e = romeParts(new Date(c.end));
    if (!byDay.has(s.date)) continue;
    const endMin = e.date === s.date ? e.minutes : 24 * 60;
    byDay.get(s.date)!.push({ title: c.title, start: toHHMM(s.minutes), end: toHHMM(Math.min(endMin, 23 * 60 + 59)), allDay: false });
    busy.get(s.date)!.push({ start: s.minutes, end: endMin });
  }
  for (const list of byDay.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  return { byDay, busy };
}

function buildDemands(data: StudentData, statuses: SubjectStatus[], from: string, weekEnd: string, s: PlannerSettings): Demand[] {
  const demands: Demand[] = [];
  const gapOf = (subject: string) => statuses.find((x) => normalizeSubject(x.subject) === normalizeSubject(subject))?.gap ?? 0;
  const horizon = addDays(weekEnd, s.prepDays); // tests early next week are prepared this week

  for (const a of data.agenda) {
    if (a.date <= from || a.date > horizon) continue;
    const until = daysBetween(from, a.date);
    if (a.kind === "verifica" || a.kind === "interrogazione") {
      const label = a.kind === "verifica" ? "Verifica" : "Interrogazione";
      demands.push({
        subject: a.subject,
        kind: a.kind,
        minutes: a.kind === "verifica" ? s.minutesPerTest : s.minutesPerOralTest,
        deadline: a.date,
        earliest: addDays(a.date, -s.prepDays),
        reason: `${label} ${dayLabel(a.date)}${a.text ? `: ${a.text}` : ""}`,
        priority: 100 - until * 5 + gapOf(a.subject) * 10,
      });
    } else if (a.kind === "compito") {
      demands.push({
        subject: a.subject,
        kind: "compito",
        minutes: s.minutesPerHomework,
        deadline: a.date,
        earliest: addDays(a.date, -3),
        reason: `Compiti per ${dayLabel(a.date)}${a.text ? `: ${a.text}` : ""}`,
        priority: 80 - until * 5,
      });
    }
  }

  for (const st of statuses) {
    if (st.gap <= 0) continue;
    // ~1 block per half point of gap, between 1 and 3 blocks a week
    const blocks = Math.min(3, Math.max(1, Math.round(st.gap * 2)));
    demands.push({
      subject: st.subject,
      kind: "recupero",
      minutes: blocks * s.blockMinutes,
      deadline: addDays(weekEnd, 1),
      earliest: from,
      reason: `Media ${st.average?.toFixed(2).replace(".", ",")} contro obiettivo ${String(st.target).replace(".", ",")}`,
      priority: st.gap * 20,
    });
  }

  // Deadlines first (earliest deadline first), then recovery of subjects below target
  const rank = (d: Demand) => (d.kind === "recupero" ? 1 : 0);
  return demands.sort((a, b) => rank(a) - rank(b) || a.deadline.localeCompare(b.deadline) || b.priority - a.priority);
}

/**
 * Builds the study plan for the week starting on `weekStart` (a Monday).
 * Days before `today` are not planned.
 */
export function planWeek(
  data: StudentData,
  weekStart: string,
  today: string,
  settings: PlannerSettings = defaultSettings,
): WeekPlan {
  const s = settings;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const from = today > weekStart ? today : weekStart;
  const statuses = subjectStatuses(data, today);
  const { byDay, busy } = commitmentsByDay(data, days);

  // Free intervals per day
  const free = new Map<string, Interval[]>();
  const used = new Map<string, number>();
  const perSubject = new Map<string, number>();
  const initialFree = new Map<string, number>();
  for (const d of days) {
    const w = s.windows[weekday(d)];
    let ivs: Interval[] = d >= from && w ? [{ start: toMinutes(w.start), end: toMinutes(w.end) }] : [];
    for (const b of busy.get(d)!) {
      ivs = subtract(ivs, { start: b.start - s.bufferMinutes, end: b.end + s.bufferMinutes });
    }
    free.set(d, ivs);
    used.set(d, 0);
    initialFree.set(d, ivs.reduce((t, iv) => t + iv.end - iv.start, 0));
  }

  const blocks: StudyBlock[] = [];
  const unmet: WeekPlan["unmet"] = [];

  const capacity = (d: string) => {
    const fits = free.get(d)!.some((iv) => iv.end - iv.start >= s.blockMinutes);
    return fits ? s.maxMinutesPerDay - used.get(d)! : 0;
  };

  const place = (d: string, demand: Demand) => {
    const ivs = free.get(d)!;
    const idx = ivs.findIndex((iv) => iv.end - iv.start >= s.blockMinutes);
    const iv = ivs[idx];
    const start = iv.start;
    const end = start + s.blockMinutes;
    ivs.splice(idx, 1, ...(end + s.breakMinutes < iv.end ? [{ start: end + s.breakMinutes, end: iv.end }] : []));
    used.set(d, used.get(d)! + s.blockMinutes);
    const key = `${d}|${normalizeSubject(demand.subject)}`;
    perSubject.set(key, (perSubject.get(key) ?? 0) + 1);
    blocks.push({
      date: d,
      start: toHHMM(start),
      end: toHHMM(end),
      subject: demand.subject,
      kind: demand.kind,
      reason: demand.reason,
      topics: recentTopics(demand.subject, data.lessons, data.agenda, demand.kind === "recupero" ? today : demand.deadline),
    });
  };

  for (const demand of buildDemands(data, statuses, from, weekEnd, s)) {
    let remaining = Math.ceil(demand.minutes / s.blockMinutes);
    const eligible = days.filter((d) => d >= from && d >= demand.earliest && d < demand.deadline);
    while (remaining > 0) {
      const candidates = eligible.filter(
        (d) =>
          capacity(d) >= s.blockMinutes &&
          (perSubject.get(`${d}|${normalizeSubject(demand.subject)}`) ?? 0) < s.maxBlocksPerSubjectPerDay,
      );
      if (candidates.length === 0) break;
      // Spread: pick the day with the fewest blocks of this subject, then the most spare capacity, then the latest
      // (for tests, closer to the date helps memory; for homework, the day before).
      candidates.sort((a, b) => {
        const sa = perSubject.get(`${a}|${normalizeSubject(demand.subject)}`) ?? 0;
        const sb = perSubject.get(`${b}|${normalizeSubject(demand.subject)}`) ?? 0;
        if (sa !== sb) return sa - sb;
        if (demand.kind === "recupero") return capacity(b) - capacity(a) || a.localeCompare(b);
        return b.localeCompare(a);
      });
      place(candidates[0], demand);
      remaining--;
    }
    // Tests early next week can still be prepared then: report only what is really missing
    if (remaining > 0 && demand.kind !== "recupero" && demand.deadline <= addDays(weekEnd, 1)) {
      unmet.push({ subject: demand.subject, kind: demand.kind, minutes: remaining * s.blockMinutes, reason: demand.reason });
    }
  }

  return {
    weekStart,
    days: days.map((d) => ({
      date: d,
      commitments: byDay.get(d)!,
      blocks: blocks.filter((b) => b.date === d).sort((a, b) => a.start.localeCompare(b.start)),
      freeMinutes: initialFree.get(d)!,
    })),
    subjects: statuses,
    unmet,
  };
}
