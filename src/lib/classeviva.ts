import { compact } from "./dates";
import type { AgendaItem, AgendaKind, Grade, Lesson } from "./types";

/**
 * Minimal client for the unofficial ClasseViva REST API (the one used by the mobile app).
 * It is not documented by Spaggiari and can change without notice. Server side only.
 */
const BASE = "https://web.spaggiari.eu/rest/v1";
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "CVVS/std/4.2.3 Android/12",
  "Z-Dev-Apikey": "Tg1NWEwNGIgIC0K",
};

type FetchLike = typeof fetch;

export type Session = { token: string; studentId: string; expire: string };

export class ClasseVivaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function login(user: string, pass: string, f: FetchLike = fetch): Promise<Session> {
  const res = await f(`${BASE}/auth/login`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ ident: null, pass, uid: user }),
    cache: "no-store",
  });
  if (!res.ok) throw new ClasseVivaError(`Login ClasseViva fallito (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { ident?: string; token?: string; expire?: string };
  if (!body.token || !body.ident) throw new ClasseVivaError("Risposta di login ClasseViva inattesa");
  return { token: body.token, studentId: body.ident.replace(/\D/g, ""), expire: body.expire ?? "" };
}

async function get<T>(session: Session, path: string, f: FetchLike): Promise<T> {
  const res = await f(`${BASE}/students/${session.studentId}${path}`, {
    headers: { ...HEADERS, "Z-Auth-Token": session.token },
    cache: "no-store",
  });
  if (!res.ok) throw new ClasseVivaError(`ClasseViva ${path}: HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

type RawGrade = {
  subjectDesc: string;
  evtDate: string;
  decimalValue: number | null;
  weightFactor?: number | null;
  componentDesc?: string;
  canceled?: boolean;
};

export async function fetchGrades(session: Session, f: FetchLike = fetch): Promise<Grade[]> {
  const { grades } = await get<{ grades: RawGrade[] }>(session, "/grades", f);
  return grades
    .filter((g) => !g.canceled && typeof g.decimalValue === "number")
    .map((g) => ({
      subject: titleCase(g.subjectDesc),
      value: g.decimalValue as number,
      date: g.evtDate,
      weight: g.weightFactor ?? 1,
      kind: g.componentDesc || undefined,
    }));
}

type RawAgenda = {
  evtId: number;
  evtCode: string;
  evtDatetimeBegin: string;
  notes: string | null;
  subjectDesc: string | null;
  authorName: string | null;
};

type RawSubject = { description: string; teachers: { teacherName: string }[] };

export function classifyAgenda(code: string, notes: string): AgendaKind {
  const n = notes.toLowerCase();
  if (/interrogaz/.test(n)) return "interrogazione";
  if (/verific|compito in classe|test\b|prova|simulazione/.test(n)) return "verifica";
  if (code === "AGHW" || /compit|eserciz|pag\.|pagina|studiare|ripassare/.test(n)) return "compito";
  return "altro";
}

export async function fetchAgenda(session: Session, from: string, to: string, f: FetchLike = fetch): Promise<AgendaItem[]> {
  const [{ agenda }, { subjects }] = await Promise.all([
    get<{ agenda: RawAgenda[] }>(session, `/agenda/all/${compact(from)}/${compact(to)}`, f),
    get<{ subjects: RawSubject[] }>(session, "/subjects", f),
  ]);
  // Agenda entries often lack the subject: infer it from the teacher
  const byTeacher = new Map<string, string>();
  for (const s of subjects) for (const t of s.teachers ?? []) {
    if (!byTeacher.has(t.teacherName.toLowerCase())) byTeacher.set(t.teacherName.toLowerCase(), s.description);
  }
  return agenda.map((a) => {
    const notes = a.notes ?? "";
    const subject = a.subjectDesc ?? byTeacher.get((a.authorName ?? "").toLowerCase()) ?? "Altro";
    return {
      id: String(a.evtId),
      subject: titleCase(subject),
      date: a.evtDatetimeBegin.slice(0, 10),
      kind: classifyAgenda(a.evtCode, notes),
      text: notes.trim(),
    };
  });
}

type RawLesson = { evtDate: string; subjectDesc: string; lessonArg: string | null };

export async function fetchLessons(session: Session, from: string, to: string, f: FetchLike = fetch): Promise<Lesson[]> {
  const { lessons } = await get<{ lessons: RawLesson[] }>(session, `/lessons/${compact(from)}/${compact(to)}`, f);
  return lessons
    .filter((l) => l.lessonArg && l.lessonArg.trim())
    .map((l) => ({ subject: titleCase(l.subjectDesc), date: l.evtDate, topic: (l.lessonArg ?? "").trim() }));
}

/** "MATEMATICA" -> "Matematica", "LINGUA E LETTERATURA ITALIANA" -> "Lingua e letteratura italiana" */
export function titleCase(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
