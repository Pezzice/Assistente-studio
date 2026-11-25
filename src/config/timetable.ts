import type { SchoolDay } from "@/lib/types";

/** Orario scolastico di Gabriele, seconda liceo scientifico (0 = domenica ... 6 = sabato). */
export const timetable: SchoolDay[] = [
  { weekday: 1, start: "08:00", end: "13:55", subjects: ["Italiano", "Fisica", "Alternativa", "Inglese"] },
  { weekday: 2, start: "08:00", end: "13:05", subjects: ["Latino", "Fisica", "Motoria", "Matematica"] },
  { weekday: 3, start: "08:00", end: "13:05", subjects: ["Matematica", "Italiano", "Scienze"] },
  { weekday: 4, start: "08:00", end: "13:05", subjects: ["Latino", "Inglese", "Storia"] },
  { weekday: 5, start: "08:00", end: "13:55", subjects: ["Scienze", "Storia", "Matematica", "Arte"] },
];

/** Tempi dopo la scuola: rientro a casa e pranzo. */
export const afterSchool = { travelMinutes: 45, lunchMinutes: 45 };

/** Fine dello studio nei giorni di scuola (poi cena e tempo libero). */
export const weekdayStudyEnd = "19:30";

/**
 * Giorni senza scuola, weekend leggero: il sabato una mattina breve, la domenica un'ora e mezza
 * nel pomeriggio usata solo se c'è una verifica o dei compiti a inizio settimana.
 */
export const freeDayWindows = {
  saturday: [{ start: "10:00", end: "12:00" }],
  sunday: [{ start: "16:00", end: "17:45" }],
};
