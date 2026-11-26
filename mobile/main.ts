import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { goals } from "@/config/goals";
import { commitmentsFromFile, type CalendarFile } from "@/lib/calendar-file";
import { fetchAgenda, fetchGrades, fetchLessons, login } from "@/lib/classeviva";
import { addDays, dayLabel, mondayOf, romeToIso, toMinutes, todayInRome, weekday } from "@/lib/dates";
import { planWeek } from "@/lib/planner";
import type { BlockKind, StudentData } from "@/lib/types";
import "./styles.css";

/**
 * Android app: reads ClasseViva from the phone (same network path as the official app),
 * keeps the credentials only in the phone's secure storage, and computes the plan locally.
 * Gabriele's commitments come from the web app's synced calendar.
 */

type Settings = { user: string; pass: string; server: string; pin: string };
type Cache = Pick<StudentData, "grades" | "agenda" | "lessons"> & {
  calendar: CalendarFile | null;
  updatedAt: string;
};

const DEFAULT_SERVER = "https://assistentestudio-pezzice.vercel.app";
const CACHE_KEY = "assistente-studio-cache";
const app = document.getElementById("app")!;

const kindLabel: Record<BlockKind, string> = {
  verifica: "Verifica",
  interrogazione: "Interrogazione",
  compito: "Compiti",
  recupero: "Recupero",
  ripasso: "Nuovi argomenti",
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmtGrade = (n: number | null) => (n === null ? "–" : n.toFixed(2).replace(".", ","));
const shortDate = (d: string) => dayLabel(d).split(" ").slice(0, 3).join(" ");
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" });

async function loadSettings(): Promise<Settings | null> {
  const raw = (await SecureStorage.get("settings").catch(() => null)) as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Settings;
  } catch {
    return null;
  }
}

async function saveSettings(s: Settings) {
  await SecureStorage.set("settings", JSON.stringify(s));
}

function loadCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

async function refresh(s: Settings): Promise<{ cache: Cache; errors: string[] }> {
  const today = todayInRome();
  const errors: string[] = [];
  const session = await login(s.user, s.pass);
  const [grades, agenda, lessons] = await Promise.all([
    fetchGrades(session),
    fetchAgenda(session, addDays(today, -60), addDays(today, 45)),
    fetchLessons(session, addDays(today, -60), today),
  ]);
  let calendar: CalendarFile | null = loadCache()?.calendar ?? null;
  if (s.server && s.pin) {
    try {
      const res = await fetch(`${s.server.replace(/\/$/, "")}/api/calendario`, { headers: { "x-family-pin": s.pin } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      calendar = (await res.json()) as CalendarFile;
    } catch (e) {
      errors.push(`Calendario non scaricato (${(e as Error).message}): uso l'ultima copia.`);
    }
  }
  const cache: Cache = { grades, agenda, lessons, calendar, updatedAt: new Date().toISOString() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  return { cache, errors };
}

function renderSettings(current: Settings | null, message = "") {
  app.innerHTML = `
    <p class="eyebrow">Assistente studio</p>
    <h1>Impostazioni</h1>
    ${message ? `<p class="notice error">${esc(message)}</p>` : ""}
    <form class="settings" id="settings">
      <label>Utente ClasseViva di Gabriele
        <input name="user" autocomplete="username" required value="${esc(current?.user ?? "")}" />
      </label>
      <label>Password ClasseViva
        <input name="pass" type="password" autocomplete="current-password" required value="${esc(current?.pass ?? "")}" />
      </label>
      <label>Indirizzo dell'app web (per il calendario)
        <input name="server" type="url" value="${esc(current?.server ?? DEFAULT_SERVER)}" />
      </label>
      <label>PIN di famiglia
        <input name="pin" type="password" inputmode="numeric" value="${esc(current?.pin ?? "")}" />
      </label>
      <p class="hint">Le credenziali restano solo su questo telefono, nella memoria protetta.</p>
      <button type="submit">Salva e aggiorna</button>
    </form>`;
  document.getElementById("settings")!.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target as HTMLFormElement);
    const s: Settings = {
      user: String(f.get("user") ?? "").trim(),
      pass: String(f.get("pass") ?? ""),
      server: String(f.get("server") ?? "").trim(),
      pin: String(f.get("pin") ?? "").trim(),
    };
    await saveSettings(s);
    await update(s);
  });
}

let weekStart = (() => {
  const t = todayInRome();
  return weekday(t) === 0 ? addDays(t, 1) : mondayOf(t);
})();

function renderPlan(cache: Cache, errors: string[]) {
  const today = todayInRome();
  const commitments = cache.calendar?.updatedAt
    ? commitmentsFromFile(
        cache.calendar,
        new Date(romeToIso(weekStart, "00:00")),
        new Date(romeToIso(addDays(weekStart, 7), "00:00")),
      )
    : [];
  const plan = planWeek(
    { grades: cache.grades, agenda: cache.agenda, lessons: cache.lessons, commitments, goals },
    weekStart,
    today,
  );
  const blocks = plan.days.flatMap((d) => d.blocks);
  const minutes = blocks.reduce((t, b) => t + toMinutes(b.end) - toMinutes(b.start), 0);

  const days = plan.days
    .map((day) => {
      const allDay = day.commitments
        .filter((c) => c.allDay)
        .map((c) => `<div class="commitment"><span class="time">tutto il giorno</span>${esc(c.title)}</div>`)
        .join("");
      const items = [
        ...day.commitments.filter((c) => !c.allDay).map((c) => ({ at: c.start, html: `<div class="commitment"><span class="time">${c.start}–${c.end}</span>${esc(c.title)}</div>` })),
        ...day.blocks.map((b) => ({
          at: b.start,
          html: `<div class="block k-${b.kind}">
            <div class="block-head"><span class="time">${b.start}–${b.end}</span><span class="tag">${kindLabel[b.kind]}</span></div>
            <div class="subject">${esc(b.subject)}</div>
            <div class="reason">${esc(b.reason)}</div>
            ${b.topics.length ? `<details><summary>Argomenti da ripassare</summary><ul>${b.topics.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></details>` : ""}
          </div>`,
        })),
      ]
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((x) => x.html)
        .join("");
      const empty = day.blocks.length === 0 && day.date >= today ? `<p class="empty">Nessuno studio previsto</p>` : "";
      const cls = `day${day.date === today ? " today" : ""}${day.date < today ? " past" : ""}`;
      return `<article class="${cls}"><h2>${dayLabel(day.date)}</h2>${allDay}${items}${empty}</article>`;
    })
    .join("");

  const subjects = plan.subjects
    .map(
      (s) => `<tr class="${s.gap > 0 ? "below" : ""}"><td>${esc(s.subject)}</td><td class="num">${fmtGrade(s.average)}</td><td class="num">${fmtGrade(s.target)}</td><td>${s.nextTest ? `${shortDate(s.nextTest.date)} · ${s.nextTest.kind}` : "–"}</td></tr>`,
    )
    .join("");

  app.innerHTML = `
    <header class="top">
      <div>
        <p class="eyebrow">Piano di studio di Gabriele</p>
        <h1>Settimana dal ${shortDate(weekStart)}</h1>
        <p class="sub">${String(Math.round((minutes / 60) * 10) / 10).replace(".", ",")} ore di studio in ${plan.days.filter((d) => d.blocks.length).length} giorni</p>
      </div>
      <nav class="weeknav">
        <button data-week="-7">← Prec.</button>
        <button data-week="0">Oggi</button>
        <button data-week="7">Succ. →</button>
      </nav>
    </header>
    <div class="actions">
      <button id="refresh">Aggiorna da ClasseViva</button>
      <button id="settings">Impostazioni</button>
    </div>
    <p class="sub">ClasseViva aggiornato il ${fmtTime(cache.updatedAt)}${cache.calendar?.updatedAt ? ` · calendario del ${fmtTime(cache.calendar.updatedAt)}` : " · calendario non disponibile"}</p>
    ${errors.map((e) => `<p class="notice error">${esc(e)}</p>`).join("")}
    ${plan.unmet.length ? `<section class="unmet"><h2>Non ci sta tutto</h2><ul>${plan.unmet.map((u) => `<li><strong>${esc(u.subject)}</strong>: mancano ${u.minutes} minuti (${esc(u.reason)})</li>`).join("")}</ul></section>` : ""}
    <section class="days">${days}</section>
    <section class="subjects"><h2>Materie</h2><div class="table-wrap"><table>
      <thead><tr><th>Materia</th><th class="num">Media</th><th class="num">Obiettivo</th><th>Prossima prova</th></tr></thead>
      <tbody>${subjects}</tbody></table></div></section>`;

  app.querySelectorAll<HTMLButtonElement>("[data-week]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = Number(b.dataset.week);
      const t = todayInRome();
      weekStart = n === 0 ? (weekday(t) === 0 ? addDays(t, 1) : mondayOf(t)) : addDays(weekStart, n);
      renderPlan(cache, errors);
    }),
  );
  document.getElementById("refresh")!.addEventListener("click", async () => {
    const s = await loadSettings();
    if (s) await update(s);
  });
  document.getElementById("settings")!.addEventListener("click", async () => renderSettings(await loadSettings()));
}

async function update(s: Settings) {
  app.innerHTML = `<p class="sub">Aggiornamento da ClasseViva…</p>`;
  try {
    const { cache, errors } = await refresh(s);
    renderPlan(cache, errors);
  } catch (e) {
    const cache = loadCache();
    const msg = `ClasseViva: ${(e as Error).message}`;
    if (cache) renderPlan(cache, [msg + " (mostro l'ultima copia)"]);
    else renderSettings(s, msg);
  }
}

async function start() {
  const s = await loadSettings();
  if (!s) return renderSettings(null);
  const cache = loadCache();
  const stale = !cache || Date.now() - Date.parse(cache.updatedAt) > 3 * 36e5;
  if (cache && !stale) renderPlan(cache, []);
  else await update(s);
}

start();
