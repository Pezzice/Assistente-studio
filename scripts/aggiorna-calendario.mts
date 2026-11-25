/**
 * Aggiorna data/calendario.json a partire da uno o più file JSON di eventi Google Calendar
 * (risposte di list_events, con `events: [...]`), tenendo solo gli impegni di Gabriele.
 * Uso: npm run aggiorna:calendario -- <da YYYY-MM-DD> <a YYYY-MM-DD> file1.json [file2.json ...]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { toCalendarFile, type GoogleEvent } from "../src/lib/calendar-file";

const [from, to, ...files] = process.argv.slice(2);
if (!from || !to || files.length === 0) {
  console.error("Uso: npm run aggiorna:calendario -- <da> <a> file1.json [file2.json ...]");
  process.exit(1);
}
const events: GoogleEvent[] = files.flatMap((f) => {
  const j = JSON.parse(readFileSync(f, "utf8"));
  return Array.isArray(j) ? j : (j.events ?? []);
});
const file = toCalendarFile(events, { from, to });
writeFileSync("data/calendario.json", JSON.stringify(file, null, 2) + "\n");
console.log(`Eventi letti: ${events.length}, impegni di Gabriele salvati: ${file.events.length}`);
