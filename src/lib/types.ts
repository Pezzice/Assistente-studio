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

export type PlannerSettings = {
  /** Study window per weekday, 0 = Sunday ... 6 = Saturday; null = no study */
  windows: (TimeWindow | null)[];
  maxMinutesPerDay: number;
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
};

export type StudentData = {
  grades: Grade[];
  agenda: AgendaItem[];
  lessons: Lesson[];
  commitments: Commitment[];
  goals: Goal[];
};

export type BlockKind = "verifica" | "interrogazione" | "compito" | "recupero";

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
