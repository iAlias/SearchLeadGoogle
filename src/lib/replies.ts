// Cosa fare di un messaggio che arriva indietro.
//
// L'email promette «mi risponda "no grazie" e non la disturbo più». Perché
// quella frase sia vera, qualcuno deve leggere le risposte e agire: qui si
// decide, da un messaggio in chiaro, se è un rifiuto (e allora il contatto
// va spento su tutti i canali, subito) o un segnale di interesse.
//
// In caso di dubbio si sbaglia sempre dalla parte del destinatario: un
// falso rifiuto ci costa un lead, un rifiuto non riconosciuto ci costa una
// segnalazione per spam.

export type ReplyKind = "rifiuto" | "interesse" | "altro";

export interface ReplyClassification {
  kind: ReplyKind;
  /** L'espressione che ha deciso, utile per capire perché nel registro. */
  matched?: string;
}

// Espressioni che valgono come "non scrivetemi più". Sono confrontate su
// testo normalizzato: minuscolo, senza accenti e senza punteggiatura.
const RIFIUTO = [
  "no grazie",
  "non mi interessa",
  "non ci interessa",
  "non siamo interessati",
  "non sono interessato",
  "non sono interessata",
  "nessun interesse",
  "non contattatemi",
  "non contattarmi",
  "non scrivetemi",
  "non scrivermi",
  "non telefonatemi",
  "toglietemi",
  "togliermi",
  "cancellatemi",
  "cancellami",
  "rimuovetemi",
  "rimuovimi",
  "disiscrivimi",
  "disiscrivetemi",
  "cancellate i miei dati",
  "cancellare i miei dati",
  "unsubscribe",
  "spam",
  "segnalo",
  "diffido",
  "diffida",
  "gdpr",
  "garante della privacy",
  "avvocato",
  "basta messaggi",
  "basta email",
  "non insistere",
  "non insista",
  "smettetela",
];

// Parole singole: pericolose come sottostringa, quindi cercate intere.
const RIFIUTO_PAROLE = ["stop", "no", "basta", "annulla"];

const INTERESSE = [
  "mi interessa",
  "ci interessa",
  "sono interessato",
  "sono interessata",
  "siamo interessati",
  "quanto costa",
  "quanto viene",
  "che prezzo",
  "il prezzo",
  "costo",
  "preventivo",
  "come funziona",
  "vorrei sapere",
  "vorrei maggiori",
  "maggiori informazioni",
  "piu informazioni",
  "puo chiamarmi",
  "puoi chiamarmi",
  "mi chiami",
  "chiamami",
  "sentiamoci",
  "possiamo sentirci",
  "va bene",
  "ci sto",
  "procediamo",
  "quando possiamo",
  "sono disponibile",
  "certo",
];

export function normalizeReply(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyReply(text: string): ReplyClassification {
  const t = normalizeReply(text);
  if (!t) return { kind: "altro" };

  // Il rifiuto vince sempre: «no grazie, quanto costa?» non esiste, mentre
  // «non mi interessa il prezzo» sì.
  for (const frase of RIFIUTO) {
    if (t.includes(frase)) return { kind: "rifiuto", matched: frase };
  }
  const parole = t.split(" ");
  for (const parola of RIFIUTO_PAROLE) {
    if (parole.includes(parola)) return { kind: "rifiuto", matched: parola };
  }

  for (const frase of INTERESSE) {
    if (t.includes(frase)) return { kind: "interesse", matched: frase };
  }

  return { kind: "altro" };
}

/** Un rifiuto va onorato spegnendo il contatto, non solo annotato. */
export function shouldSuppress(kind: ReplyKind): boolean {
  return kind === "rifiuto";
}
