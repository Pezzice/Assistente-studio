import type { Goal } from "@/lib/types";

/**
 * Obiettivi di media per materia. I nomi devono corrispondere a quelli di ClasseViva
 * (maiuscole e spazi non contano). Valori indicativi da confermare con Gabriele.
 */
export const goals: Goal[] = [
  { subject: "Matematica", target: 7 },
  { subject: "Fisica", target: 7 },
  { subject: "Lingua e letteratura italiana", target: 7 },
  { subject: "Lingua e cultura latina", target: 6.5 },
  { subject: "Lingua e cultura straniera (inglese)", target: 7.5 },
  { subject: "Storia e geografia", target: 7 },
  { subject: "Scienze naturali", target: 7 },
  { subject: "Disegno e storia dell'arte", target: 7 },
];
