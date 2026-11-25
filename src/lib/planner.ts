import { addDays, dayLabel, daysBetween, romeParts, toHHMM, toMinutes, weekday } from "./dates";
import { afterSchool, freeDayWindows, timetable, weekdayStudyEnd } from "@/config/timetable";
import type {
  AgendaItem,
  BlockKind,
  DayPlan,
  Grade,
  Lesson,
  PlannerSettings,
  StudentData,
  StudyBlock,
  SchoolDay,
  SubjectStatus,
  TimeWindow,
  WeekPlan,
} from "./types";

/** Study windows derived from the timetable: from the end of school plus travel and lunch until the evening. */
export function windowsFromTimetable(days: SchoolDay[]): TimeWindow[][] {
  return Array.from({ length: 7 }, (_, wd) => {
    const school = days.find((d) => d.weekday === wd);
    if (school) {
      const start = toMinutes(school.end) + afterSchool.travelMinutes + afterSchool.lunchMinutes;
      return [{ start: toHHMM(start), end: weekdayStudyEnd }];
    }
    if (wd === 6) return freeDayWindows.saturday;
    if (wd === 0) return freeDayWindows.sunday;
    return [];
  });
}

export const defaultSettings: PlannerSettings = {
  windows: windowsFromTimetable(timetable),
  // Lighter weekend: Saturday 1h30, Sunday 1h30 and only for deadlines
  maxMinutesPerDay: [90, 180, 180, 180, 180, 180, 90],
  timetable,
  blockMinutes: 45,
  breakMinutes: 15,
  bufferMinutes: 30,
  minutesPerTest: 180,
  minutesPerOralTest: 135,
  minutesPerHomework: 45,
  prepDays: 4,
  maxBlocksPerSubjectPerDay: 2,
  newTopicsThreshold: 3,
  maxReviewBlocksPerWeek: 3,
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

// Order matters: "Scienze motorie" is Motoria, "Disegno e storia dell'arte" is Arte
const SUBJECT_KEYS: [RegExp, string][] = [
  [/motori/, "motoria"],
  [/arte|disegno/, "arte"],
  [/italian/, "italiano"],
  [/latin/, "latino"],
  [/ingles|english/, "inglese"],
  [/matemat/, "matematica"],
  [/fisic/, "fisica"],
  [/scienz/, "scienze"],
  [/stori|geograf/, "storia"],
  [/religion/, "religione"],
  [/alternativ/, "alternativa"],
  [/civic/, "civica"],
];

/** Canonical subject key, so "LINGUA E CULTURA LATINA" and "Latino" match. */
export function normalizeSubject(s: string): string {
  const t = s.trim().toLowerCase().replace(/\s+/g, " ");
  return SUBJECT_KEYS.find(([re]) => re.test(t))?.[1] ?? t;
}

/** Next school day after `date` that has a lesson of `subject`, within 7 days. */
function nextLessonDay(subject: string, date: string, days: SchoolDay[]): string | null {
  const key = normalizeSubject(subject);
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i);
    const school = days.find((x) => x.weekday === weekday(d));
    if (school?.subjects.some((x) => normalizeSubject(x) === key)) return d;
  }
  return null;
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
      const grades = data.grades
        .filter((g) => normalizeSubject(g.subject) === key)
        .sort((a, b) => a.date.localeCompare(b.date));
      const average = weightedAverage(grades);
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
      const lastGrade = grades.at(-1)?.value ?? null;
      const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
      const values = grades.map((g) => g.value);
      const trend =
        values.length >= 3
          ? Math.round((mean(values.slice(-2)) - mean(values.slice(0, -2))) * 100) / 100
          : values.length === 2
            ? values[1] - values[0]
            : null;
      const lastTest = data.agenda
        .filter((a) => normalizeSubject(a.subject) === key && (a.kind === "verifica" || a.kind === "interrogazione") && a.date < today)
        .map((a) => a.date)
        .sort()
        .at(-1);
      const since = lastTest && lastTest > addDays(today, -7) ? lastTest : addDays(today, -7);
      const newTopics = data.lessons.filter(
        (l) => normalizeSubject(l.subject) === key && l.date >= since && l.date < today && l.topic.trim(),
      ).length;
      return { subject, average, target, gap, nextTest, lastGrade, trend, newTopics };
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

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * How much extra work a subject needs this week, from grades and their trend.
 * Recovery: 1 block per half point below target (1–3); at least 1 after a grade below 6,
 * one more if grades are falling, one less if they are clearly rising.
 * Test preparation: +45 min if behind, −45 min if comfortably above target and steady.
 */
export function adaptiveLoad(st: SubjectStatus, s: PlannerSettings) {
  let recovery = st.gap > 0 ? Math.min(3, Math.max(1, Math.round(st.gap * 2))) : 0;
  const notes: string[] = [];
  if (st.lastGrade !== null && st.lastGrade < 6) {
    recovery = Math.max(recovery, st.gap > 0 ? 2 : 1);
    notes.push(`ultimo voto ${fmt(st.lastGrade)}`);
  }
  if (st.trend !== null && st.trend <= -0.5 && (st.gap > 0 || (st.target !== null && st.lastGrade !== null && st.lastGrade < st.target))) {
    recovery += 1;
    notes.push("voti in calo");
  } else if (st.trend !== null && st.trend >= 0.5 && recovery > 0) {
    recovery = Math.max(st.gap > 0.5 ? 1 : 0, recovery - 1);
    notes.push("voti in miglioramento");
  }
  recovery = Math.min(3, recovery);

  let testMinutes = 0;
  if (st.gap > 0.5 || (st.lastGrade !== null && st.lastGrade < 6)) testMinutes = s.blockMinutes;
  else if (st.average !== null && st.target !== null && st.average >= st.target + 0.5 && (st.trend ?? 0) >= 0) {
    testMinutes = -s.blockMinutes;
  }
  return { recovery, testMinutes, notes };
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

  const statusOf = (subject: string) => statuses.find((x) => normalizeSubject(x.subject) === normalizeSubject(subject));

  // Test preparation adapts to how the subject is going
  for (const d of demands) {
    const st = statusOf(d.subject);
    if (st && (d.kind === "verifica" || d.kind === "interrogazione")) {
      d.minutes = Math.max(s.blockMinutes, d.minutes + adaptiveLoad(st, s).testMinutes);
    }
  }

  const ripasso: Demand[] = [];
  for (const st of statuses) {
    const { recovery, notes } = adaptiveLoad(st, s);
    if (recovery > 0) {
      const base =
        st.gap > 0
          ? `Media ${fmt(st.average ?? 0)} contro obiettivo ${fmt(st.target ?? 0)}`
          : `Media ${st.average !== null ? fmt(st.average) : "–"}`;
      demands.push({
        subject: st.subject,
        kind: "recupero",
        minutes: recovery * s.blockMinutes,
        deadline: addDays(weekEnd, 1),
        earliest: from,
        reason: [base, ...notes].join(" · "),
        priority: st.gap * 20 + recovery * 5,
      });
      continue;
    }
    // Consolidate new topics when no test is coming and the subject is on track
    const testSoon = demands.some((d) => normalizeSubject(d.subject) === normalizeSubject(st.subject) && d.kind !== "recupero");
    if (st.newTopics >= s.newTopicsThreshold && !testSoon) {
      ripasso.push({
        subject: st.subject,
        kind: "ripasso",
        minutes: s.blockMinutes,
        deadline: addDays(weekEnd, 1),
        earliest: from,
        reason: `${st.newTopics} lezioni con argomenti nuovi questa settimana`,
        priority: st.newTopics,
      });
    }
  }
  demands.push(...ripasso.sort((a, b) => b.priority - a.priority).slice(0, s.maxReviewBlocksPerWeek));

  // Deadlines first (earliest deadline first), then recovery of subjects below target
  // Homework from ClasseViva always comes first, then tests, then recovery and review
  const rank = (d: Demand) => ({ compito: 0, verifica: 1, interrogazione: 1, recupero: 2, ripasso: 3 })[d.kind];
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
    let ivs: Interval[] =
      d >= from ? s.windows[weekday(d)].map((w) => ({ start: toMinutes(w.start), end: toMinutes(w.end) })) : [];
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
    return fits ? s.maxMinutesPerDay[weekday(d)] - used.get(d)! : 0;
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
      reason:
        (demand.kind === "recupero" || demand.kind === "ripasso") && nextLessonDay(demand.subject, d, s.timetable) === addDays(d, 1)
          ? `${demand.reason} · domani c'è lezione`
          : demand.reason,
      topics: recentTopics(
        demand.subject,
        data.lessons,
        data.agenda,
        demand.kind === "recupero" || demand.kind === "ripasso" ? today : demand.deadline,
      ),
    });
  };

  for (const demand of buildDemands(data, statuses, from, weekEnd, s)) {
    let remaining = Math.ceil(demand.minutes / s.blockMinutes);
    const eligible = days.filter((d) => d >= from && d >= demand.earliest && d < demand.deadline);
    while (remaining > 0) {
      const candidates = eligible.filter(
        (d) =>
          capacity(d) >= s.blockMinutes &&
          (perSubject.get(`${d}|${normalizeSubject(demand.subject)}`) ?? 0) < s.maxBlocksPerSubjectPerDay &&
          // Sunday only for deadlines (a test or homework early in the week)
          !(weekday(d) === 0 && (demand.kind === "recupero" || demand.kind === "ripasso")),
      );
      if (candidates.length === 0) break;
      // Spread: pick the day with the fewest blocks of this subject, then the most spare capacity, then the latest
      // (for tests, closer to the date helps memory; for homework, the day before).
      candidates.sort((a, b) => {
        const sa = perSubject.get(`${a}|${normalizeSubject(demand.subject)}`) ?? 0;
        const sb = perSubject.get(`${b}|${normalizeSubject(demand.subject)}`) ?? 0;
        if (sa !== sb) return sa - sb;
        if (demand.kind === "recupero" || demand.kind === "ripasso") {
          // Prefer the afternoon before a lesson of that subject
          const ta = nextLessonDay(demand.subject, a, s.timetable) === addDays(a, 1) ? 1 : 0;
          const tb = nextLessonDay(demand.subject, b, s.timetable) === addDays(b, 1) ? 1 : 0;
          return tb - ta || capacity(b) - capacity(a) || a.localeCompare(b);
        }
        return b.localeCompare(a);
      });
      place(candidates[0], demand);
      remaining--;
    }
    // Tests early next week can still be prepared then: report only what is really missing
    if (remaining > 0 && demand.kind !== "recupero" && demand.kind !== "ripasso" && demand.deadline <= addDays(weekEnd, 1)) {
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
