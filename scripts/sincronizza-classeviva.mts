/**
 * Da lanciare su un computer di casa (ClasseViva blocca le richieste dai server cloud).
 * Scarica voti, agenda e lezioni con le credenziali in .env.local, aggiorna
 * data/classeviva.json e, se è cambiato, fa commit e push: Vercel ripubblica l'app.
 * Uso: npm run sincronizza:classeviva
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fetchAgenda, fetchGrades, fetchLessons, login } from "../src/lib/classeviva";
import { addDays, todayInRome } from "../src/lib/dates";

const FILE = "data/classeviva.json";
const { CLASSEVIVA_USER, CLASSEVIVA_PASS } = process.env;
if (!CLASSEVIVA_USER || !CLASSEVIVA_PASS) {
  console.error("Mancano CLASSEVIVA_USER e CLASSEVIVA_PASS in .env.local (vedi .env.example).");
  process.exit(1);
}

const sh = (cmd: string) => execSync(cmd, { stdio: "pipe" }).toString().trim();
try {
  sh("git pull --rebase --quiet");
} catch {
  console.warn("git pull non riuscito: continuo con la copia locale.");
}

const today = todayInRome();
const session = await login(CLASSEVIVA_USER, CLASSEVIVA_PASS);
const [grades, agenda, lessons] = await Promise.all([
  fetchGrades(session),
  fetchAgenda(session, addDays(today, -60), addDays(today, 45)),
  fetchLessons(session, addDays(today, -60), today),
]);

const body = { grades, agenda, lessons };
const previous = JSON.parse(readFileSync(FILE, "utf8"));
const { updatedAt: _u, ...prevBody } = previous;
if (JSON.stringify(prevBody) === JSON.stringify(body)) {
  console.log(`Nessuna novità (${grades.length} voti, ${agenda.length} voci in agenda, ${lessons.length} lezioni).`);
  process.exit(0);
}
writeFileSync(FILE, JSON.stringify({ updatedAt: new Date().toISOString(), ...body }, null, 2) + "\n");
sh(`git add ${FILE}`);
sh(`git commit --quiet -m "ClasseViva aggiornato ${today}"`);
sh("git push --quiet");
console.log(`Aggiornato e pubblicato: ${grades.length} voti, ${agenda.length} voci in agenda, ${lessons.length} lezioni.`);
