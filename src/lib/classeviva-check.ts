import { addDays, todayInRome } from "./dates";
import { fetchAgenda, fetchGrades, fetchLessons, login } from "./classeviva";
import { normalizeSubject } from "./planner";

/**
 * Checks the real ClasseViva connection and returns a summary with no secrets:
 * counts, subjects found, how agenda entries were classified, and subjects that do not
 * match the timetable or goals (to fix names).
 */
export async function checkClasseViva(user: string, pass: string, knownSubjects: string[]) {
  const today = todayInRome();
  const steps: { step: string; ok: boolean; detail: string }[] = [];
  const region = process.env.VERCEL_REGION;
  if (region) steps.push({ step: "Server", ok: true, detail: `regione Vercel ${region}` });
  let session;
  try {
    session = await login(user, pass);
    steps.push({ step: "Login", ok: true, detail: `studente ${session.studentId.replace(/\d(?=\d{2})/g, "•")}` });
  } catch (e) {
    steps.push({ step: "Login", ok: false, detail: (e as Error).message });
    return { steps };
  }
  const run = async <T,>(step: string, fn: () => Promise<T>, describe: (x: T) => string) => {
    try {
      const x = await fn();
      steps.push({ step, ok: true, detail: describe(x) });
      return x;
    } catch (e) {
      steps.push({ step, ok: false, detail: (e as Error).message });
      return null;
    }
  };
  const grades = await run("Voti", () => fetchGrades(session), (g) => `${g.length} voti`);
  const agenda = await run(
    "Agenda",
    () => fetchAgenda(session, addDays(today, -30), addDays(today, 30)),
    (a) => {
      const by = (k: string) => a.filter((x) => x.kind === k).length;
      return `${a.length} eventi: ${by("verifica")} verifiche, ${by("interrogazione")} interrogazioni, ${by("compito")} compiti, ${by("altro")} altro`;
    },
  );
  const lessons = await run(
    "Lezioni",
    () => fetchLessons(session, addDays(today, -21), today),
    (l) => `${l.length} lezioni con argomento`,
  );

  const subjects = [...new Set([...(grades ?? []), ...(agenda ?? []), ...(lessons ?? [])].map((x) => x.subject))].sort();
  const known = new Set(knownSubjects.map(normalizeSubject));
  return {
    steps,
    subjects: subjects.map((s) => ({ name: s, key: normalizeSubject(s), matched: known.has(normalizeSubject(s)) })),
    upcoming: (agenda ?? [])
      .filter((a) => a.date >= today && a.kind !== "altro")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10)
      .map((a) => ({ date: a.date, subject: a.subject, kind: a.kind, text: a.text.slice(0, 80) })),
    unclassified: (agenda ?? []).filter((a) => a.kind === "altro").slice(0, 10).map((a) => a.text.slice(0, 80)),
  };
}
