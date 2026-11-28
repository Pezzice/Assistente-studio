/** Frasi motivazionali, una al giorno a rotazione (scritte per l'app, nessuna citazione attribuita). */
export const phrases: string[] = [
  "Un'ora fatta bene oggi vale più di tre ore di corsa la sera prima.",
  "Non serve essere perfetti: serve esserci, un blocco alla volta.",
  "Ogni esercizio che ti sembra difficile oggi sarà facile alla verifica.",
  "La costanza batte il talento quando il talento non è costante.",
  "Comincia dalla cosa che rimandi: dopo, il resto pesa la metà.",
  "Quaranta minuti di concentrazione vera valgono un pomeriggio di distrazioni.",
  "Sbagliare un esercizio a casa è il modo più economico di imparare.",
  "Il voto di domani si costruisce con lo studio di oggi.",
  "Spegni le notifiche, accendi la testa: tra poco sei libero.",
  "Capire una cosa una volta è meglio che ripeterla dieci volte a memoria.",
  "Piccoli passi ogni giorno fanno strada lunga a fine quadrimestre.",
  "Una pausa fatta bene è parte dello studio, non una fuga.",
  "Se una materia ti fa paura, dalle un po' di tempo in più: si ammorbidisce.",
  "Oggi basta fare il prossimo blocco. Solo quello.",
  "Fare i compiti subito libera la serata per quello che ti piace.",
  "La fatica di adesso è il tempo libero di dopo.",
  "Chi ripassa un po' ogni giorno non deve mai ripassare tutto in una notte.",
  "Allenamento e studio funzionano uguale: si migliora ripetendo.",
  "Prova a spiegare l'argomento a voce alta: se ci riesci, l'hai capito.",
  "Un buon voto non è fortuna, è preparazione che si vede.",
  "Inizia con cinque minuti: quasi sempre diventano quaranta.",
  "Le domande che fai oggi sono le risposte che saprai domani.",
  "Non confrontarti con gli altri: confrontati con te della settimana scorsa.",
  "Una pagina capita vale più di dieci pagine lette.",
  "Il cervello impara anche mentre dormi, ma solo se prima gli dai qualcosa.",
  "Quando sei stanco, cambia materia invece di smettere.",
  "Ogni verifica superata è un pezzo di libertà in più.",
  "La motivazione va e viene, l'abitudine resta.",
  "Un errore corretto non torna più: cerca i tuoi errori e sistemali.",
  "Studiare con il piano è più leggero che studiare con l'ansia.",
  "Finire quello che hai iniziato è già una vittoria.",
  "Anche la materia più noiosa diventa interessante quando la capisci.",
  "Fai oggi quello che il te di venerdì ti ringrazierà di aver fatto.",
  "Il talento si allena: in palestra come sui libri.",
  "Chiudi un argomento prima di aprirne un altro.",
  "Ogni blocco segnato come completo è un passo verso il tuo obiettivo.",
  "Non devi avere voglia per cominciare: la voglia arriva cominciando.",
  "Il tempo che dedichi alle basi ti fa risparmiare ore dopo.",
  "Settimana nuova, pagina bianca: scrivila bene.",
  "Domani è più facile se oggi hai fatto la tua parte.",
];

/** Same phrase all day, a different one each day. */
export function phraseOfTheDay(date: string): string {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 864e5);
  return phrases[((day % phrases.length) + phrases.length) % phrases.length];
}
