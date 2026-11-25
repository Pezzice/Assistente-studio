import "server-only";
import { goals } from "@/config/goals";
import { fetchFamilyCommitments } from "./calendar";
import { fetchAgenda, fetchGrades, fetchLessons, login } from "./classeviva";
import { addDays, romeToIso } from "./dates";
import { sampleData } from "./sample-data";
import type { StudentData } from "./types";

export type LoadedData = StudentData & {
  sources: { classeviva: "reale" | "esempio"; calendario: "reale" | "esempio" | "non collegato" };
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

  if (CLASSEVIVA_USER && CLASSEVIVA_PASS) {
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

  // With real school data, never mix in sample commitments
  if (!FAMILY_ICS_URL && out.sources.classeviva === "reale") {
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
