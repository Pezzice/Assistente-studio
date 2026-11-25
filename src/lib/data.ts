import "server-only";
import { goals } from "@/config/goals";
import calendarFile from "../../data/calendario.json";
import schoolFile from "../../data/classeviva.json";
import { fetchFamilyCommitments } from "./calendar";
import { commitmentsFromFile, type CalendarFile } from "./calendar-file";
import { fetchAgenda, fetchGrades, fetchLessons, login } from "./classeviva";
import { addDays, romeToIso } from "./dates";
import { sampleData } from "./sample-data";
import type { StudentData } from "./types";

export type LoadedData = StudentData & {
  sources: { classeviva: "reale" | "sincronizzato" | "esempio"; calendario: "reale" | "sincronizzato" | "esempio" | "non collegato" };
  calendarUpdatedAt?: string;
  schoolUpdatedAt?: string;
  errors: string[];
};

/**
 * Loads everything the planner needs for the week starting `weekStart`.
 * Falls back to sample data for each source that has no configuration or fails.
 */
export async function loadData(weekStart: string): Promise<LoadedData> {
  const sample = sampleData(weekStart);
  const errors: string[] = [];
  const out: LoadedData = { ...sample, goals, sources: { classeviva: "esempio", calendario: "esempio" }, errors };

  const { CLASSEVIVA_USER, CLASSEVIVA_PASS, FAMILY_ICS_URL } = process.env;

  // School data synced from a computer at home (ClasseViva blocks requests from cloud servers)
  const school = schoolFile as unknown as { updatedAt: string } & Pick<StudentData, "grades" | "agenda" | "lessons">;
  if (school.updatedAt) {
    Object.assign(out, { grades: school.grades, agenda: school.agenda, lessons: school.lessons });
    out.sources.classeviva = "sincronizzato";
    out.schoolUpdatedAt = school.updatedAt;
    const hours = (Date.now() - Date.parse(school.updatedAt)) / 36e5;
    if (hours > 36) errors.push(`Dati ClasseViva non aggiornati da ${Math.round(hours / 24)} giorni`);
  } else if (CLASSEVIVA_USER && CLASSEVIVA_PASS) {
    try {
      const session = await login(CLASSEVIVA_USER, CLASSEVIVA_PASS);
      const [grades, agenda, lessons] = await Promise.all([
        fetchGrades(session),
        fetchAgenda(session, addDays(weekStart, -60), addDays(weekStart, 21)),
        fetchLessons(session, addDays(weekStart, -45), addDays(weekStart, 7)),
      ]);
      Object.assign(out, { grades, agenda, lessons });
      out.sources.classeviva = "reale";
    } catch (e) {
      errors.push(`ClasseViva: ${(e as Error).message}`);
    }
  }

  // Calendar synced by Claude into data/calendario.json (used when there is no iCal address)
  const synced = calendarFile as CalendarFile;
  if (!FAMILY_ICS_URL && synced.updatedAt) {
    out.commitments = commitmentsFromFile(
      synced,
      new Date(romeToIso(weekStart, "00:00")),
      new Date(romeToIso(addDays(weekStart, 7), "00:00")),
    );
    out.sources.calendario = "sincronizzato";
    out.calendarUpdatedAt = synced.updatedAt;
    if (addDays(weekStart, 7) > synced.to) errors.push(`Calendario sincronizzato solo fino al ${synced.to}`);
  } else if (!FAMILY_ICS_URL && out.sources.classeviva !== "esempio") {
    // With real school data, never mix in sample commitments
    out.commitments = [];
    out.sources.calendario = "non collegato";
  }

  if (FAMILY_ICS_URL) {
    try {
      out.commitments = await fetchFamilyCommitments(
        FAMILY_ICS_URL,
        new Date(romeToIso(weekStart, "00:00")),
        new Date(romeToIso(addDays(weekStart, 7), "00:00")),
      );
      out.sources.calendario = "reale";
    } catch (e) {
      errors.push(`Calendario: ${(e as Error).message}`);
    }
  }

  return out;
}
