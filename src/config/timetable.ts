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

/** Giorni senza scuola: fasce di studio, il resto è tempo libero e famiglia. */
export const freeDayWindows = {
  saturday: [
    { start: "09:30", end: "12:30" },
    { start: "15:00", end: "18:00" },
  ],
  sunday: [{ start: "15:00", end: "18:00" }],
};
