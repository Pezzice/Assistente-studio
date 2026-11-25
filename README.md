# Assistente studio

Web app (installabile sul telefono) che ogni settimana propone a Gabriele un piano di studio:
legge voti, verifiche, compiti e argomenti da **ClasseViva**, gli impegni dal calendario
Google **Famiglia**, e distribuisce blocchi di studio nei pomeriggi liberi verso gli
**obiettivi di voto** per materia.

## Come funziona il piano

1. **Tempo libero**: nei giorni di scuola si parte dalla fine delle lezioni più 45 minuti di
   rientro e 45 di pranzo (lun e ven 15:25, mar–gio 14:35) fino alle 19:30; sabato 9:30–12:30 e
   15:00–18:00, domenica 15:00–18:00 (massimo 2 ore). Si tolgono gli impegni di Gabriele, con
   30 minuti di margine per gli spostamenti.
2. **Cosa serve**: ogni verifica chiede 3 ore (interrogazione 2 ore e 15) distribuite nei 4 giorni
   precedenti; i compiti un blocco nei 3 giorni prima della consegna; le materie sotto
   obiettivo da 1 a 3 blocchi di recupero.
3. **Assegnazione**: blocchi da 45 minuti con 15 di pausa, massimo 3 ore al giorno e 2 blocchi
   della stessa materia al giorno; prima le scadenze più vicine, poi il recupero.
4. **Orario scolastico**: i blocchi di recupero vanno di preferenza il pomeriggio prima di una
   lezione di quella materia (`src/config/timetable.ts`).
5. **Argomenti**: per ogni blocco, gli argomenti svolti a lezione dall'ultima verifica.

Tutti i parametri sono in `src/lib/planner.ts` (`defaultSettings`), gli obiettivi in
`src/config/goals.ts`, la regola per riconoscere gli impegni di Gabriele in
`src/lib/calendar.ts` (`defaultFilter`).

## Configurazione

Senza variabili d'ambiente l'app mostra dati di esempio. Per i dati veri (vedi `.env.example`):

| Variabile | Cosa |
| --- | --- |
| `CLASSEVIVA_USER`, `CLASSEVIVA_PASS` | Credenziali ClasseViva dello studente |
| `FAMILY_ICS_URL` | Indirizzo segreto iCal del calendario Famiglia |
| `FAMILY_PIN` | PIN per aprire l'app |

Le credenziali si inseriscono solo su Vercel (Settings → Environment Variables) o in un
`.env.local` che non va mai committato.

## Sviluppo

```bash
npm install
npm test        # test del motore, del calendario e del client ClasseViva
npm run dev     # http://localhost:3000
```

Stack: Next.js 15, TypeScript, ical.js, Vitest. L'API di ClasseViva usata è quella non
ufficiale dell'app mobile: può cambiare senza preavviso.
