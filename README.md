# Assistente studio

Web app (installabile sul telefono) che ogni settimana propone a Gabriele un piano di studio:
legge voti, verifiche, compiti e argomenti da **ClasseViva**, gli impegni dal calendario
Google **Famiglia**, e distribuisce blocchi di studio nei pomeriggi liberi verso gli
**obiettivi di voto** per materia.

## Come funziona il piano

1. **Tempo libero**: nei giorni di scuola si parte dalla fine delle lezioni più 45 minuti di
   rientro e 45 di pranzo (lun e ven 15:25, mar–gio 14:35) fino alle 19:30; sabato 15:00–17:00 (la
   mattina è per i mestieri di casa), domenica 16:00–17:45 solo per verifiche o compiti di inizio
   settimana. Si tolgono gli impegni di Gabriele, con
   30 minuti di margine per gli spostamenti.
2. **Cosa serve**: ogni verifica chiede 3 ore (interrogazione 2 ore e 15) distribuite nei 4 giorni
   precedenti; i compiti un blocco nei 3 giorni prima della consegna; le materie sotto
   obiettivo da 1 a 3 blocchi di recupero.
3. **Assegnazione**: blocchi da 45 minuti con 15 di pausa, massimo 3 ore al giorno e 2 blocchi
   della stessa materia al giorno; prima sempre i compiti assegnati su ClasseViva, poi le verifiche, poi recupero e ripasso.
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

## Verificare ClasseViva

- In locale: metti le credenziali in `.env.local` e lancia `npm run verifica:classeviva`.
  Stampa login, numero di voti, agenda e lezioni, le materie trovate e come sono state
  classificate le voci dell'agenda. Non stampa mai le credenziali.
- Online: la pagina `/diagnostica` (protetta dal PIN) mostra lo stesso riepilogo.

## Calendario sincronizzato

Se `FAMILY_ICS_URL` non è impostata, l'app legge gli impegni da `data/calendario.json`.
Il file contiene solo gli impegni di Gabriele (titolo e orari) ed è aggiornato ogni mattina da
un'attività pianificata di Claude, che legge il calendario Famiglia e lancia:

```bash
npm run aggiorna:calendario -- <da YYYY-MM-DD> <a YYYY-MM-DD> eventi.json
```

Ogni aggiornamento è un commit su `main`, quindi Vercel ripubblica l'app da solo.

## ClasseViva sincronizzato da casa

ClasseViva blocca con un filtro anti-bot (HTTP 403) le richieste che arrivano dai server cloud,
Vercel compreso. Per questo voti, agenda e lezioni si scaricano da un computer di casa:

```bash
npm run sincronizza:classeviva
```

Lo script usa le credenziali in `.env.local`, aggiorna `data/classeviva.json` e, se ci sono
novità, fa commit e push su `main`; Vercel ripubblica l'app da solo. Va pianificato più volte
al giorno sul computer di casa.

## App Android

ClasseViva blocca le richieste dai server, ma non quelle dal telefono di Gabriele. L'app Android
(`mobile/`, impacchettata con Capacitor) legge ClasseViva direttamente dal telefono con le
richieste HTTP native, tiene le credenziali solo nella memoria protetta del telefono e calcola il
piano sul telefono. Gli impegni arrivano dall'app web (`/api/calendario`, con il PIN di famiglia).

Ogni push su `main` che tocca l'app fa partire il workflow "App Android", che pubblica
`assistente-studio.apk` nella release `android` del repository.

```bash
npm run mobile:build   # bundle web dell'app in mobile/dist
npm run android:sync   # bundle + copia nel progetto android/
```
