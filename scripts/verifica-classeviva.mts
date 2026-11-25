/**
 * Verifica il collegamento a ClasseViva con le credenziali in .env.local.
 * Uso: npm run verifica:classeviva
 * Non stampa mai le credenziali.
 */
import { goals } from "../src/config/goals";
import { timetable } from "../src/config/timetable";
import { checkClasseViva } from "../src/lib/classeviva-check";

const { CLASSEVIVA_USER, CLASSEVIVA_PASS } = process.env;
if (!CLASSEVIVA_USER || !CLASSEVIVA_PASS) {
  console.error("Mancano CLASSEVIVA_USER e CLASSEVIVA_PASS in .env.local (vedi .env.example).");
  process.exit(1);
}

const known = [...goals.map((g) => g.subject), ...timetable.flatMap((d) => d.subjects)];
const r = await checkClasseViva(CLASSEVIVA_USER, CLASSEVIVA_PASS, known);
for (const s of r.steps) console.log(`${s.ok ? "OK " : "ERR"} ${s.step}: ${s.detail}`);
if ("subjects" in r) {
  console.log("\nMaterie trovate:");
  for (const s of r.subjects ?? []) console.log(`  ${s.matched ? "✓" : "?"} ${s.name}  (${s.key})`);
  console.log("\nProssime prove e compiti:");
  for (const a of r.upcoming ?? []) console.log(`  ${a.date} ${a.kind.padEnd(14)} ${a.subject}: ${a.text}`);
  if (r.unclassified?.length) {
    console.log("\nAgenda non classificata (da controllare):");
    for (const t of r.unclassified) console.log(`  - ${t}`);
  }
}
process.exit(r.steps.every((s) => s.ok) ? 0 : 1);
