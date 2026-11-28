/** Date are "YYYY-MM-DD" strings in Europe/Rome time; times are "HH:MM". */

export type Grade = {
  subject: string;
  value: number;
  date: string;
  weight: number;
  kind?: string;
};

export type AgendaKind = "verifica" | "interrogazione" | "compito" | "altro";

export type AgendaItem = {
  id: string;
  subject: string;
  date: string;
  kind: AgendaKind;
  text: string;
};

export type Lesson = {
  subject: string;
  date: string;
  topic: string;
};

export type Commitment = {
  title: string;
  /** ISO timestamps */
  start: string;
  end: string;
  allDay: boolean;
};

export type Goal = {
  subject: string;
  target: number;
};

export type TimeWindow = { start: string; end: string };

export type SchoolDay = {
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  start: string;
  end: string;
  subjects: string[];
};

export type PlannerSettings = {
  /** Study windows per weekday, 0 = Sunday ... 6 = Saturday; empty = no study */
  windows: TimeWindow[][];
  /** Maximum study minutes per weekday, 0 = Sunday ... 6 = Saturday */
  maxMinutesPerDay: number[];
  /** School timetable: recovery blocks prefer the day before a lesson of that subject */
  timetable: SchoolDay[];
  blockMinutes: number;
  breakMinutes: number;
  /** Travel margin around each commitment */
  bufferMinutes: number;
  /** Total preparation per test */
  minutesPerTest: number;
  minutesPerOralTest: number;
  minutesPerHomework: number;
  /** Days before a test over which preparation is spread */
  prepDays: number;
  /** Maximum blocks of the same subject in a day */
  maxBlocksPerSubjectPerDay: number;
  /** Lessons with new topics in a week that trigger a review block */
  newTopicsThreshold: number;
  maxReviewBlocksPerWeek: number;
};

export type StudentData = {
  grades: Grade[];
  agenda: AgendaItem[];
  lessons: Lesson[];
  commitments: Commitment[];
  goals: Goal[];
  /** Work left over from blocks marked "parziale" or "non fatto" */
  carryOver?: CarryOver[];
};

export type CarryOver = { subject: string; minutes: number; reason: string };

export type BlockStatus = "completo" | "parziale" | "non fatto";

export type BlockKind = "verifica" | "interrogazione" | "compito" | "recupero" | "ripasso";

export type StudyBlock = {
  date: string;
  start: string;
  end: string;
  subject: string;
  kind: BlockKind;
  reason: string;
  topics: string[];
};

export type SubjectStatus = {
  subject: string;
  average: number | null;
  target: number | null;
  gap: number;
  nextTest: AgendaItem | null;
  lastGrade: number | null;
  /** Mean of the last 2 grades minus mean of the earlier ones; positive = improving */
  trend: number | null;
  /** Lessons with a topic in the last 7 days, since the last test */
  newTopics: number;
};

export type DayPlan = {
  date: string;
  commitments: { title: string; start: string; end: string; allDay: boolean }[];
  blocks: StudyBlock[];
  freeMinutes: number;
};

export type WeekPlan = {
  weekStart: string;
  days: DayPlan[];
  subjects: SubjectStatus[];
  /** Demands that did not fit in the free time */
  unmet: { subject: string; kind: BlockKind; minutes: number; reason: string }[];
};
