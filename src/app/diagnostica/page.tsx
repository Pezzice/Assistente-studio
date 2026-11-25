import { goals } from "@/config/goals";
import { timetable } from "@/config/timetable";
import { checkClasseViva } from "@/lib/classeviva-check";

export const dynamic = "force-dynamic";

/** Stato del collegamento a ClasseViva (protetta dal PIN come il resto dell'app). */
export default async function Diagnostica() {
  const { CLASSEVIVA_USER, CLASSEVIVA_PASS } = process.env;
  if (!CLASSEVIVA_USER || !CLASSEVIVA_PASS) {
    return (
      <main>
        <h1>Diagnostica ClasseViva</h1>
        <p className="notice">Credenziali non configurate: aggiungi CLASSEVIVA_USER e CLASSEVIVA_PASS nelle variabili d&apos;ambiente.</p>
      </main>
    );
  }
  const known = [...goals.map((g) => g.subject), ...timetable.flatMap((d) => d.subjects)];
  const r = await checkClasseViva(CLASSEVIVA_USER, CLASSEVIVA_PASS, known);
  return (
    <main>
      <h1>Diagnostica ClasseViva</h1>
      <ul>
        {r.steps.map((s) => (
          <li key={s.step} className={s.ok ? "" : "error"}>
            {s.ok ? "✓" : "✗"} <strong>{s.step}</strong>: {s.detail}
          </li>
        ))}
      </ul>
      {"subjects" in r && (
        <>
          <h2>Materie trovate</h2>
          <ul>
            {r.subjects?.map((s) => (
              <li key={s.name}>{s.matched ? "✓" : "?"} {s.name}</li>
            ))}
          </ul>
          <h2>Prossime prove e compiti</h2>
          <ul>
            {r.upcoming?.map((a, i) => (
              <li key={i}>{a.date} · {a.kind} · {a.subject}: {a.text}</li>
            ))}
          </ul>
          {r.unclassified && r.unclassified.length > 0 && (
            <>
              <h2>Agenda non classificata</h2>
              <ul>{r.unclassified.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
