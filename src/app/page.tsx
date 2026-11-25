import Link from "next/link";
import { loadData } from "@/lib/data";
import { addDays, dayLabel, toMinutes } from "@/lib/dates";
import { planWeek } from "@/lib/planner";
import type { BlockKind } from "@/lib/types";
import { resolveWeek } from "@/lib/week";

export const dynamic = "force-dynamic";

const kindLabel: Record<BlockKind, string> = {
  verifica: "Verifica",
  interrogazione: "Interrogazione",
  compito: "Compiti",
  recupero: "Recupero",
  ripasso: "Nuovi argomenti",
};

const fmtGrade = (n: number | null) => (n === null ? "–" : n.toFixed(2).replace(".", ","));
const fmtDate = (d: string) => dayLabel(d).split(" ").slice(0, 3).join(" ");

export default async function Home({ searchParams }: { searchParams: Promise<{ settimana?: string }> }) {
  const { settimana } = await searchParams;
  const { today, weekStart } = resolveWeek(settimana);
  const data = await loadData(weekStart);
  const plan = planWeek(data, weekStart, today);
  const totalMin = plan.days.flatMap((d) => d.blocks).reduce((t, b) => t + toMinutes(b.end) - toMinutes(b.start), 0);
  const demo = data.sources.classeviva === "esempio" || data.sources.calendario === "esempio";

  return (
    <main>
      <header className="top">
        <div>
          <p className="eyebrow">Piano di studio di Gabriele</p>
          <h1>Settimana dal {fmtDate(weekStart)}</h1>
          <p className="sub">
            {String(Math.round((totalMin / 60) * 10) / 10).replace(".", ",")} ore di studio in {plan.days.filter((d) => d.blocks.length).length} giorni
          </p>
        </div>
        <nav className="weeknav" aria-label="Cambia settimana">
          <Link href={`/?settimana=${addDays(weekStart, -7)}`}>← Prec.</Link>
          <Link href="/">Oggi</Link>
          <Link href={`/?settimana=${addDays(weekStart, 7)}`}>Succ. →</Link>
        </nav>
      </header>

      {demo && (
        <p className="notice">
          Dati di esempio per {data.sources.classeviva === "esempio" ? "ClasseViva" : ""}
          {data.sources.classeviva === "esempio" && data.sources.calendario === "esempio" ? " e " : ""}
          {data.sources.calendario === "esempio" ? "calendario" : ""}: configura le variabili d&apos;ambiente per vedere quelli veri.
        </p>
      )}
      {data.schoolUpdatedAt && (
        <p className="sub">
          Voti e agenda da ClasseViva, aggiornati il{" "}
          {new Date(data.schoolUpdatedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
      {data.sources.calendario === "sincronizzato" && data.calendarUpdatedAt && (
        <p className="sub">
          Impegni dal calendario Famiglia, aggiornati il{" "}
          {new Date(data.calendarUpdatedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
      {data.sources.calendario === "non collegato" && (
        <p className="notice">Calendario Famiglia non collegato: il piano non tiene conto degli impegni.</p>
      )}
      {data.errors.map((e) => (
        <p key={e} className="notice error">{e}</p>
      ))}

      {plan.unmet.length > 0 && (
        <section className="unmet">
          <h2>Non ci sta tutto</h2>
          <ul>
            {plan.unmet.map((u) => (
              <li key={u.reason}>
                <strong>{u.subject}</strong>: mancano {u.minutes} minuti ({u.reason})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="days">
        {plan.days.map((day) => (
          <article key={day.date} className={`day${day.date === today ? " today" : ""}${day.date < today ? " past" : ""}`}>
            <h2>{dayLabel(day.date)}</h2>
            {day.commitments.filter((c) => c.allDay).map((c, i) => (
              <div key={`a${i}`} className="commitment">
                <span className="time">tutto il giorno</span>
                {c.title}
              </div>
            ))}
            {day.blocks.length === 0 && day.date >= today && <p className="empty">Nessuno studio previsto</p>}
            {[
              ...day.commitments.filter((c) => !c.allDay).map((c) => ({ at: c.start, c, b: null })),
              ...day.blocks.map((b) => ({ at: b.start, c: null, b })),
            ]
              .sort((x, y) => x.at.localeCompare(y.at))
              .map(({ at, c, b }) =>
                c ? (
                  <div key={`c${at}${c.title}`} className="commitment">
                    <span className="time">{c.start}–{c.end}</span>
                    {c.title}
                  </div>
                ) : b ? (
                  <div key={`b${at}`} className={`block k-${b.kind}`}>
                    <div className="block-head">
                      <span className="time">{b.start}–{b.end}</span>
                      <span className="tag">{kindLabel[b.kind]}</span>
                    </div>
                    <div className="subject">{b.subject}</div>
                    <div className="reason">{b.reason}</div>
                    {b.topics.length > 0 && (
                      <details>
                        <summary>Argomenti da ripassare</summary>
                        <ul>{b.topics.map((t) => <li key={t}>{t}</li>)}</ul>
                      </details>
                    )}
                  </div>
                ) : null,
              )}
          </article>
        ))}
      </section>

      <section className="subjects">
        <h2>Materie</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Materia</th>
                <th className="num">Media</th>
                <th className="num">Obiettivo</th>
                <th>Prossima prova</th>
              </tr>
            </thead>
            <tbody>
              {plan.subjects.map((s) => (
                <tr key={s.subject} className={s.gap > 0 ? "below" : ""}>
                  <td>{s.subject}</td>
                  <td className="num">{fmtGrade(s.average)}</td>
                  <td className="num">{fmtGrade(s.target)}</td>
                  <td>{s.nextTest ? `${fmtDate(s.nextTest.date)} · ${s.nextTest.kind}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
