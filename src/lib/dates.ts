export const TIME_ZONE = "Europe/Rome";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Local date and minutes after midnight in Rome for an instant. */
export function romeParts(d: Date): { date: string; minutes: number } {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function todayInRome(now = new Date()): string {
  return romeParts(now).date;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function mondayOf(date: string): string {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "YYYYMMDD" as used by the ClasseViva API */
export function compact(date: string): string {
  return date.replaceAll("-", "");
}

const dayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${dayNames[weekday(date)]} ${d} ${monthNames[m - 1]}`;
}

/** ISO instant for a wall-clock time in Rome (handles CET/CEST). */
export function romeToIso(date: string, hhmm: string): string {
  for (const off of ["+01:00", "+02:00"]) {
    const d = new Date(`${date}T${hhmm}:00${off}`);
    const p = romeParts(d);
    if (p.date === date && p.minutes === toMinutes(hhmm)) return d.toISOString();
  }
  return new Date(`${date}T${hhmm}:00+01:00`).toISOString();
}
