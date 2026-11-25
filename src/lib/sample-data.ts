import { goals } from "@/config/goals";
import { addDays, romeToIso } from "./dates";
import type { StudentData } from "./types";

/** Realistic demo data around the given week, used when no credentials are configured. */
export function sampleData(weekStart: string): StudentData {
  const d = (n: number) => addDays(weekStart, n); // 0 = Monday
  const ev = (day: number, start: string, end: string, title: string) => ({
    title,
    start: romeToIso(d(day), start),
    end: romeToIso(d(day), end),
    allDay: false,
  });

  return {
    goals,
    grades: [
      { subject: "Matematica", value: 6, date: d(-30), weight: 1 },
      { subject: "Matematica", value: 5.5, date: d(-12), weight: 1 },
      { subject: "Matematica", value: 6.75, date: d(-5), weight: 1 },
      { subject: "Fisica", value: 7, date: d(-20), weight: 1 },
      { subject: "Fisica", value: 6.5, date: d(-8), weight: 1 },
      { subject: "Lingua e letteratura italiana", value: 7, date: d(-25), weight: 1 },
      { subject: "Lingua e letteratura italiana", value: 7.5, date: d(-10), weight: 1 },
      { subject: "Lingua e cultura latina", value: 5, date: d(-18), weight: 1 },
      { subject: "Lingua e cultura latina", value: 6, date: d(-6), weight: 1 },
      { subject: "Lingua e cultura straniera (inglese)", value: 8, date: d(-15), weight: 1 },
      { subject: "Storia e geografia", value: 7, date: d(-14), weight: 1 },
      { subject: "Scienze naturali", value: 6.5, date: d(-9), weight: 1 },
      { subject: "Disegno e storia dell'arte", value: 7.5, date: d(-11), weight: 1 },
    ],
    agenda: [
      { id: "a1", subject: "Matematica", date: d(-12), kind: "verifica", text: "Verifica disequazioni" },
      { id: "a2", subject: "Lingua e cultura latina", date: d(-6), kind: "verifica", text: "Verifica di versione" },
      { id: "a3", subject: "Matematica", date: d(3), kind: "verifica", text: "Verifica sistemi lineari" },
      { id: "a4", subject: "Lingua e cultura latina", date: d(8), kind: "interrogazione", text: "Interrogazione seconda declinazione e verbi" },
      { id: "a5", subject: "Fisica", date: d(2), kind: "compito", text: "Esercizi pag. 112 n. 4-10" },
      { id: "a6", subject: "Lingua e letteratura italiana", date: d(4), kind: "compito", text: "Analisi del testo: I promessi sposi cap. 8" },
    ],
    lessons: [
      { subject: "Matematica", date: d(-10), topic: "Sistemi lineari: metodo di sostituzione" },
      { subject: "Matematica", date: d(-7), topic: "Metodo di riduzione e Cramer" },
      { subject: "Matematica", date: d(-3), topic: "Problemi con i sistemi" },
      { subject: "Lingua e cultura latina", date: d(-4), topic: "Seconda declinazione, nomi in -er" },
      { subject: "Lingua e cultura latina", date: d(-1), topic: "Indicativo perfetto attivo" },
      { subject: "Fisica", date: d(-2), topic: "Forze e equilibrio del punto materiale" },
      { subject: "Lingua e letteratura italiana", date: d(-3), topic: "I promessi sposi, capitoli 7 e 8" },
      { subject: "Scienze naturali", date: d(-2), topic: "La cellula procariote ed eucariote" },
    ],
    commitments: [
      ev(1, "19:15", "20:45", "Basket allenamenti U16"),
      ev(2, "18:00", "19:30", "Basket allenamenti U16"),
      ev(4, "19:30", "21:00", "Basket allenamenti U16"),
      ev(4, "12:30", "14:00", "Gabriele mangia al Mc Donald's"),
      ev(5, "11:30", "13:30", "Partita Basket U17"),
    ],
  };
}
