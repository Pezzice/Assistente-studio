import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { goals } from "@/config/goals";
import { phraseOfTheDay } from "@/config/motivation";
import { commitmentsFromFile, type CalendarFile } from "@/lib/calendar-file";
import { fetchAgenda, fetchGrades, fetchLessons, login } from "@/lib/classeviva";
import { addDays, dayLabel, mondayOf, romeParts, romeToIso, toMinutes, todayInRome, weekday } from "@/lib/dates";
import { planWeek } from "@/lib/planner";
import type { BlockKind, BlockStatus, CarryOver, StudentData, StudyBlock, WeekPlan } from "@/lib/types";
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
type View = "home" | "week" | "next" | "settings";

const DEFAULT_SERVER = "https://assistentestudio-pezzice.vercel.app";
const KEYS = {
  cache: "assistente-studio-cache",
  feedback: "assistente-studio-feedback",
  snapshots: "assistente-studio-snapshots",
};
const app = document.getElementById("app")!;

const kindLabel: Record<BlockKind, string> = {
  verifica: "Verifica",
  interrogazione: "Interrogazione",
  compito: "Compiti",
  recupero: "Recupero",
  ripasso: "Nuovi argomenti",
};
const statusLabel: Record<BlockStatus, string> = { completo: "Completo", parziale: "Parziale", "non fatto": "Non fatto" };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmtGrade = (n: number | null) => (n === null ? "–" : n.toFixed(2).replace(".", ","));
const shortDate = (d: string) => dayLabel(d).split(" ").slice(0, 3).join(" ");
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" });
const hours = (min: number) => String(Math.round((min / 60) * 10) / 10).replace(".", ",");
const blockKey = (b: StudyBlock) => `${b.date}|${b.start}|${b.subject}`;
const currentMonday = () => {
  const t = todayInRome();
  return weekday(t) === 0 ? addDays(t, 1) : mondayOf(t);
};

// ---------- storage ----------

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the app still works for this session */
  }
}

async function loadSettings(): Promise<Settings | null> {
  const raw = (await SecureStorage.get("settings").catch(() => null)) as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Settings;
  } catch {
    return null;
  }
}
const saveSettings = (s: Settings) => SecureStorage.set("settings", JSON.stringify(s));

const loadCache = () => readJson<Cache | null>(KEYS.cache, null);
const feedback = () => readJson<Record<string, BlockStatus>>(KEYS.feedback, {});
const snapshots = () => readJson<Record<string, StudyBlock[]>>(KEYS.snapshots, {});

function setFeedback(key: string, status: BlockStatus | null) {
  const f = feedback();
  if (status) f[key] = status;
  else delete f[key];
  writeJson(KEYS.feedback, f);
}

/** Keeps what was planned for each day, so past days (and their confirmations) stay visible. */
function saveSnapshots(plan: WeekPlan, today: string) {
  const snap = snapshots();
  for (const d of plan.days) if (d.date >= today) snap[d.date] = d.blocks;
  const oldest = addDays(today, -28);
  for (const k of Object.keys(snap)) if (k < oldest) delete snap[k];
  writeJson(KEYS.snapshots, snap);
}

/** Blocks of the last 7 days marked "non fatto" (all of it) or "parziale" (half) are rescheduled. */
function carryOver(today: string): CarryOver[] {
  const f = feedback();
  const out: CarryOver[] = [];
  for (const [date, blocks] of Object.entries(snapshots())) {
    if (date >= today || date < addDays(today, -7)) continue;
    for (const b of blocks) {
      const st = f[blockKey(b)];
      if (st !== "non fatto" && st !== "parziale") continue;
      const len = toMinutes(b.end) - toMinutes(b.start);
      out.push({
        subject: b.subject,
        minutes: st === "non fatto" ? len : Math.ceil(len / 2 / 15) * 15,
        reason: `Da recuperare: ${st} ${shortDate(date)} (${kindLabel[b.kind].toLowerCase()})`,
      });
    }
  }
  return out;
}

// ---------- plan ----------

function computePlan(cache: Cache, weekStart: string, today: string): WeekPlan {
  const commitments = cache.calendar?.updatedAt
    ? commitmentsFromFile(
        cache.calendar,
        new Date(romeToIso(weekStart, "00:00")),
        new Date(romeToIso(addDays(weekStart, 7), "00:00")),
      )
    : [];
  return planWeek(
    { grades: cache.grades, agenda: cache.agenda, lessons: cache.lessons, commitments, goals, carryOver: weekStart === currentMonday() ? carryOver(today) : [] },
    weekStart,
    today,
  );
}

/** Current-week plan with past days taken from the snapshots. */
function weekPlan(cache: Cache, weekStart: string): WeekPlan {
  const today = todayInRome();
  const plan = computePlan(cache, weekStart, today);
  if (weekStart === currentMonday()) {
    saveSnapshots(plan, today);
    const snap = snapshots();
    for (const d of plan.days) if (d.date < today && snap[d.date]) d.blocks = snap[d.date];
  }
  return plan;
}

// ---------- refresh with progress ----------

type Step = { label: string; state: "todo" | "doing" | "done" | "error"; detail?: string };

function renderProgress(steps: Step[], finished: boolean) {
  const done = steps.filter((s) => s.state === "done" || s.state === "error").length;
  const pct = Math.round((done / steps.length) * 100);
  const failed = steps.some((s) => s.state === "error");
  const bar = document.getElementById("progress") ?? document.body.appendChild(Object.assign(document.createElement("div"), { id: "progress" }));
  bar.className = `progress${finished ? " finished" : ""}${failed ? " failed" : ""}`;
  bar.innerHTML = `
    <div class="progress-head">
      <strong>${finished ? (failed ? "Aggiornamento parziale" : "Fatto ✓") : "Aggiornamento in corso…"}</strong>
      <span>${pct}%</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <ul>${steps
      .map((s) => `<li class="st-${s.state}">${{ todo: "○", doing: "◌", done: "✓", error: "✗" }[s.state]} ${esc(s.label)}${s.detail ? ` <span>· ${esc(s.detail)}</span>` : ""}</li>`)
      .join("")}</ul>${finished && failed ? `<p class="hint">Dove non è riuscito ho usato i dati salvati dall'ultimo aggiornamento.</p>` : ""}`;
  if (finished) setTimeout(() => bar.remove(), failed ? 8000 : 2500);
}

let refreshing = false;
async function refresh(s: Settings) {
  if (refreshing) return;
  refreshing = true;
  const today = todayInRome();
  const old = loadCache();
  const steps: Step[] = [
    { label: "Accesso a ClasseViva", state: "todo" },
    { label: "Voti", state: "todo" },
    { label: "Compiti, verifiche e interrogazioni", state: "todo" },
    { label: "Argomenti delle lezioni", state: "todo" },
    { label: "Calendario di famiglia", state: "todo" },
    { label: "Ricalcolo del piano", state: "todo" },
  ];
  const run = async <T,>(i: number, fn: () => Promise<T>, detail?: (x: T) => string): Promise<T | null> => {
    steps[i].state = "doing";
    renderProgress(steps, false);
    try {
      const x = await fn();
      steps[i].state = "done";
      if (detail) steps[i].detail = detail(x);
      return x;
    } catch (e) {
      steps[i].state = "error";
      steps[i].detail = (e as Error).message;
      return null;
    } finally {
      renderProgress(steps, false);
    }
  };

  const session = await run(0, () => login(s.user, s.pass));
  const grades = session ? await run(1, () => fetchGrades(session), (g) => `${g.length}`) : null;
  const agenda = session
    ? await run(2, () => fetchAgenda(session, addDays(today, -60), addDays(today, 45)), (a) => `${a.length}`)
    : null;
  const lessons = session ? await run(3, () => fetchLessons(session, addDays(today, -60), today), (l) => `${l.length}`) : null;
  const calendar = await run(
    4,
    async () => {
      if (!s.server || !s.pin) throw new Error("indirizzo o PIN mancante");
      const res = await fetch(`${s.server.replace(/\/$/, "")}/api/calendario`, { headers: { "x-family-pin": s.pin } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as CalendarFile;
    },
    (c) => `${c.events.length} impegni`,
  );
  if (!session) for (const i of [1, 2, 3]) if (steps[i].state === "todo") (steps[i].state = "error"), (steps[i].detail = "accesso non riuscito");

  const cache: Cache = {
    grades: grades ?? old?.grades ?? [],
    agenda: agenda ?? old?.agenda ?? [],
    lessons: lessons ?? old?.lessons ?? [],
    calendar: calendar ?? old?.calendar ?? null,
    updatedAt: grades && agenda ? new Date().toISOString() : (old?.updatedAt ?? new Date(0).toISOString()),
  };
  await run(5, async () => {
    writeJson(KEYS.cache, cache);
    weekPlan(cache, currentMonday());
  });
  renderProgress(steps, true);
  refreshing = false;
  render();
}

// ---------- views ----------

let view: View = "home";
let weekStart = currentMonday();

function blockHtml(b: StudyBlock, today: string, withFeedback: boolean) {
  const f = feedback()[blockKey(b)];
  const canConfirm = withFeedback && b.date <= today;
  return `<div class="block k-${b.kind}${f ? ` fb-${f.replace(" ", "-")}` : ""}">
    <div class="block-head"><span class="time">${b.start}–${b.end}</span><span class="tag">${kindLabel[b.kind]}</span></div>
    <div class="subject">${esc(b.subject)}</div>
    <div class="reason">${esc(b.reason)}</div>
    ${b.topics.length ? `<details><summary>Argomenti da ripassare</summary><ul>${b.topics.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></details>` : ""}
    ${
      canConfirm
        ? `<div class="confirm" role="group" aria-label="Com'è andata?">${(["completo", "parziale", "non fatto"] as BlockStatus[])
            .map((st) => `<button data-key="${esc(blockKey(b))}" data-status="${st}" class="${f === st ? "on" : ""}">${statusLabel[st]}</button>`)
            .join("")}</div>`
        : ""
    }
  </div>`;
}

function dayHtml(day: WeekPlan["days"][number], today: string) {
  const allDay = day.commitments
    .filter((c) => c.allDay)
    .map((c) => `<div class="commitment"><span class="time">tutto il giorno</span>${esc(c.title)}</div>`)
    .join("");
  const items = [
    ...day.commitments
      .filter((c) => !c.allDay)
      .map((c) => ({ at: c.start, html: `<div class="commitment"><span class="time">${c.start}–${c.end}</span>${esc(c.title)}</div>` })),
    ...day.blocks.map((b) => ({ at: b.start, html: blockHtml(b, today, true) })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((x) => x.html)
    .join("");
  const empty = day.blocks.length === 0 && day.date >= today ? `<p class="empty">Nessuno studio previsto</p>` : "";
  const cls = `day${day.date === today ? " today" : ""}${day.date < today ? " past" : ""}`;
  return `<article class="${cls}"><h2>${dayLabel(day.date)}</h2>${allDay}${items}${empty}</article>`;
}

function progressSummary(plan: WeekPlan, today: string) {
  const f = feedback();
  const due = plan.days.filter((d) => d.date <= today).flatMap((d) => d.blocks);
  if (!due.length) return "";
  const count = (st: BlockStatus) => due.filter((b) => f[blockKey(b)] === st).length;
  const open = due.filter((b) => !f[blockKey(b)]).length;
  return `<p class="sub">Fin qui: ${count("completo")} completi, ${count("parziale")} parziali, ${count("non fatto")} non fatti${open ? `, ${open} da confermare` : ""}</p>`;
}

function homeView(cache: Cache) {
  const today = todayInRome();
  const plan = weekPlan(cache, currentMonday());
  const todayPlan = plan.days.find((d) => d.date === today);
  const h = romeParts(new Date()).minutes / 60;
  const hello = h < 13 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
  const tests = cache.agenda
    .filter((a) => (a.kind === "verifica" || a.kind === "interrogazione") && a.date >= today && a.date <= addDays(today, 7))
    .sort((a, b) => a.date.localeCompare(b.date));
  const blocks = todayPlan?.blocks ?? [];
  return `
    <section class="hero">
      <p class="eyebrow">${dayLabel(today)}</p>
      <h1>${hello}, Gabriele</h1>
      <blockquote class="quote">${esc(phraseOfTheDay(today))}</blockquote>
    </section>
    <section>
      <h2>Oggi</h2>
      ${
        blocks.length
          ? `<p class="sub">${blocks.length} blocchi, ${hours(blocks.reduce((t, b) => t + toMinutes(b.end) - toMinutes(b.start), 0))} ore</p>${blocks.map((b) => blockHtml(b, today, true)).join("")}`
          : `<p class="empty">Oggi niente studio in programma. Goditi la giornata.</p>`
      }
    </section>
    <section>
      <h2>Prossimi 7 giorni</h2>
      ${
        tests.length
          ? `<ul class="tests">${tests.map((t) => `<li><span class="tag-${t.kind}">${t.kind === "verifica" ? "Verifica" : "Interrogazione"}</span> <strong>${esc(t.subject)}</strong> · ${shortDate(t.date)}${t.text ? `<br><span class="reason">${esc(t.text)}</span>` : ""}</li>`).join("")}</ul>`
          : `<p class="empty">Nessuna verifica o interrogazione in arrivo.</p>`
      }
    </section>`;
}

function weekView(cache: Cache) {
  const today = todayInRome();
  const plan = weekPlan(cache, weekStart);
  const minutes = plan.days.flatMap((d) => d.blocks).reduce((t, b) => t + toMinutes(b.end) - toMinutes(b.start), 0);
  const subjects = plan.subjects
    .map(
      (s) => `<tr class="${s.gap > 0 ? "below" : ""}"><td>${esc(s.subject)}</td><td class="num">${fmtGrade(s.average)}</td><td class="num">${fmtGrade(s.target)}</td><td>${s.nextTest ? `${shortDate(s.nextTest.date)} · ${s.nextTest.kind}` : "–"}</td></tr>`,
    )
    .join("");
  return `
    <header class="top">
      <div>
        <p class="eyebrow">Piano di studio</p>
        <h1>Settimana dal ${shortDate(weekStart)}</h1>
        <p class="sub">${hours(minutes)} ore di studio in ${plan.days.filter((d) => d.blocks.length).length} giorni</p>
        ${weekStart === currentMonday() ? progressSummary(plan, today) : ""}
      </div>
      <nav class="weeknav">
        <button data-week="-7">← Prec.</button>
        <button data-week="0">Oggi</button>
        <button data-week="7">Succ. →</button>
      </nav>
    </header>
    ${plan.unmet.length ? `<section class="unmet"><h2>Non ci sta tutto</h2><ul>${plan.unmet.map((u) => `<li><strong>${esc(u.subject)}</strong>: mancano ${u.minutes} minuti (${esc(u.reason)})</li>`).join("")}</ul></section>` : ""}
    <section class="days">${plan.days.map((d) => dayHtml(d, today)).join("")}</section>
    <section class="subjects"><h2>Materie</h2><div class="table-wrap"><table>
      <thead><tr><th>Materia</th><th class="num">Media</th><th class="num">Obiettivo</th><th>Prossima prova</th></tr></thead>
      <tbody>${subjects}</tbody></table></div></section>`;
}

function nextWeekView(cache: Cache) {
  const today = todayInRome();
  const start = addDays(currentMonday(), 7);
  const end = addDays(start, 6);
  const plan = computePlan(cache, start, today);
  const inWeek = cache.agenda.filter((a) => a.date >= start && a.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const tests = inWeek.filter((a) => a.kind === "verifica" || a.kind === "interrogazione");
  const homework = inWeek.filter((a) => a.kind === "compito");
  const minutes = plan.days.flatMap((d) => d.blocks).reduce((t, b) => t + toMinutes(b.end) - toMinutes(b.start), 0);
  const perSubject = new Map<string, number>();
  for (const b of plan.days.flatMap((d) => d.blocks)) {
    perSubject.set(b.subject, (perSubject.get(b.subject) ?? 0) + toMinutes(b.end) - toMinutes(b.start));
  }
  return `
    <p class="eyebrow">Riepilogo</p>
    <h1>Settimana prossima</h1>
    <p class="sub">dal ${shortDate(start)} al ${shortDate(end)} · ${hours(minutes)} ore di studio previste</p>
    <section class="tests-box">
      <h2>Verifiche e interrogazioni</h2>
      ${
        tests.length
          ? `<ul class="tests">${tests.map((t) => `<li><span class="tag-${t.kind}">${t.kind === "verifica" ? "Verifica" : "Interrogazione"}</span> <strong>${esc(t.subject)}</strong> · ${shortDate(t.date)}${t.text ? `<br><span class="reason">${esc(t.text)}</span>` : ""}</li>`).join("")}</ul>`
          : `<p class="empty">Nessuna verifica o interrogazione segnata su ClasseViva.</p>`
      }
    </section>
    ${homework.length ? `<section><h2>Compiti da consegnare</h2><ul class="tests">${homework.map((t) => `<li><strong>${esc(t.subject)}</strong> · ${shortDate(t.date)}${t.text ? `<br><span class="reason">${esc(t.text)}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
    <section>
      <h2>Tempo per materia</h2>
      ${
        perSubject.size
          ? `<div class="table-wrap"><table><tbody>${[...perSubject.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([s, m]) => `<tr><td>${esc(s)}</td><td class="num">${hours(m)} h</td></tr>`)
              .join("")}</tbody></table></div>`
          : `<p class="empty">Nessun blocco previsto per ora.</p>`
      }
    </section>
    <section>
      <h2>Giorno per giorno</h2>
      ${plan.days
        .map(
          (d) => `<div class="mini-day"><strong>${dayLabel(d.date)}</strong>${
            d.blocks.length
              ? `<ul>${d.blocks.map((b) => `<li><span class="time">${b.start}</span> ${esc(b.subject)} <span class="tag-small k-${b.kind}">${kindLabel[b.kind]}</span></li>`).join("")}</ul>`
              : `<p class="empty">Libero</p>`
          }</div>`,
        )
        .join("")}
      <p class="hint">Il piano della settimana prossima si aggiorna con i nuovi voti e i compiti che arrivano.</p>
    </section>`;
}

function settingsView(current: Settings | null, message = "") {
  return `
    <p class="eyebrow">Assistente studio</p>
    <h1>Impostazioni</h1>
    ${message ? `<p class="notice error">${esc(message)}</p>` : ""}
    <form class="settings" id="settings-form">
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
}

const tabs: [View, string][] = [
  ["home", "Oggi"],
  ["week", "Settimana"],
  ["next", "Prossima"],
  ["settings", "Impostazioni"],
];

async function render(message = "") {
  const cache = loadCache();
  const settings = await loadSettings();
  if (!settings || !cache) view = view === "settings" || !settings ? "settings" : view;
  let body: string;
  if (view === "settings" || !cache) body = settingsView(settings, message);
  else if (view === "week") body = weekView(cache);
  else if (view === "next") body = nextWeekView(cache);
  else body = homeView(cache);

  const status = cache ? `<p class="updated">ClasseViva: ${fmtTime(cache.updatedAt)}${cache.calendar?.updatedAt ? ` · Calendario: ${fmtTime(cache.calendar.updatedAt)}` : ""}</p>` : "";
  app.innerHTML = `
    <div class="toolbar">
      <button id="refresh" class="primary" ${settings ? "" : "disabled"}>⟳ Aggiorna</button>
      ${status}
    </div>
    ${body}
    <nav class="tabbar">${tabs.map(([v, l]) => `<button data-view="${v}" class="${v === view ? "on" : ""}">${l}</button>`).join("")}</nav>`;
  bind(settings);
}

function bind(settings: Settings | null) {
  document.getElementById("refresh")?.addEventListener("click", () => settings && refresh(settings));
  app.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.view as View;
      if (view === "week") weekStart = currentMonday();
      render();
      window.scrollTo(0, 0);
    }),
  );
  app.querySelectorAll<HTMLButtonElement>("[data-week]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = Number(b.dataset.week);
      weekStart = n === 0 ? currentMonday() : addDays(weekStart, n);
      render();
    }),
  );
  app.querySelectorAll<HTMLButtonElement>("[data-status]").forEach((b) =>
    b.addEventListener("click", () => {
      const key = b.dataset.key!;
      const st = b.dataset.status as BlockStatus;
      setFeedback(key, feedback()[key] === st ? null : st);
      render();
    }),
  );
  document.getElementById("settings-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target as HTMLFormElement);
    const s: Settings = {
      user: String(f.get("user") ?? "").trim(),
      pass: String(f.get("pass") ?? ""),
      server: String(f.get("server") ?? "").trim(),
      pin: String(f.get("pin") ?? "").trim(),
    };
    await saveSettings(s);
    view = "home";
    await refresh(s);
  });
}

async function start() {
  const s = await loadSettings();
  await render();
  const cache = loadCache();
  if (s && (!cache || Date.now() - Date.parse(cache.updatedAt) > 3 * 36e5)) await refresh(s);
}

start();
