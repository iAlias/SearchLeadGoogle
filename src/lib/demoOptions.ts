// Logica dietro il wizard di generazione demo: stile visivo, sezioni
// opzionali, titolo del sito, colore primario, link alle recensioni. Tutto
// puro: nessun accesso al database, così è testabile senza un server acceso
// e riusabile sia lato server (generazione) sia lato client (wizard).

import type { Category } from "./types";

// Cinque identità visive, non cinque varianti dello stesso motore: ognuna ha
// la sua palette, la sua tipografia e le sue meccaniche di scroll. Le
// descrizioni e le mappature qui sotto sono la specifica ricevuta com'è,
// categoria per categoria — non un adattamento libero.
export type DemoStyleKey = "svizzero" | "clinico" | "industriale" | "fotografico" | "boutique";

export interface DemoStyleDef {
  key: DemoStyleKey;
  label: string;
  description: string;
}

export const DEMO_STYLES: DemoStyleDef[] = [
  { key: "svizzero", label: "Svizzero cobalto", description: "Cobalto, inchiostro e giallo zolfo. Rigore editoriale, sezioni che si bloccano e si trasformano con lo scroll. Comunica competenza e ordine — studi tecnici, legali, consulenti." },
  { key: "clinico", label: "Clinico caldo", description: "Neutri caldi, verde salvia o terracotta, angoli morbidi, molto respiro. Animazioni minime e lente: calma, non spettacolo. Prenotazione sempre a vista — sanitari, veterinari, toelettature." },
  { key: "industriale", label: "Industriale alto contrasto", description: "Nero pieno, un accento saturo, condensato maiuscolo, tagli diagonali. Ticker in movimento, numeri grandi, energia immediata — artigiani, palestre, scuole." },
  { key: "fotografico", label: "Editoriale fotografico", description: "La foto è il contenuto: hero a schermo pieno, zoom lentissimo, serif su fondo scuro. Serve poco testo e foto buone — ristoranti, pizzerie, B&B, agriturismi." },
  { key: "boutique", label: "Boutique minimale", description: "Crema o nero opaco, un solo accento metallico, tanto vuoto, ritmo rallentato. Testo che sale una riga alla volta — barbieri, estetisti, nail bar." },
];

// Lo schema funzionale è la forma dei contenuti — cosa viene messo in
// evidenza e perché — e dipende dalla categoria del lead, non dal tema
// visivo scelto: un ambulatorio veterinario resta "da prenotare" anche se
// gli si applica per prova la veste fotografica dei ristoranti. Il tema
// scelto nel wizard decide solo come questo schema viene vestito.
export type SchemaKey = "prenota" | "chiama" | "guarda" | "consulenza";

export const CATEGORY_SCHEMA: Record<Category, SchemaKey> = {
  sanitario: "prenota",
  veterinario: "prenota",
  estetista: "prenota",
  parrucchiere: "prenota",
  officina: "chiama",
  ristorante: "guarda",
  bar: "guarda",
  hotel: "guarda",
  studio_tecnico: "consulenza",
  negozio: "consulenza",
  generico: "consulenza",
};

// Il tema consigliato per ogni categoria — quello con cui il wizard si apre
// di default, restando comunque libero di sceglierne un altro. Copre le
// otto categorie della specifica ricevuta; negozio e generico (che non
// comparivano nella specifica) prendono il tema più vicino nello spirito.
export const CATEGORY_THEME: Record<Category, DemoStyleKey> = {
  studio_tecnico: "svizzero",
  sanitario: "clinico",
  veterinario: "clinico",
  officina: "industriale",
  ristorante: "fotografico",
  hotel: "fotografico",
  bar: "fotografico",
  parrucchiere: "boutique",
  estetista: "boutique",
  negozio: "boutique",
  generico: "svizzero",
};

// Colore d'accento di partenza per categoria, da proporre nel wizard come
// suggerimento già coerente col resto della demo (che poi l'utente può
// cambiare). Ogni tema lo reinterpreta a modo suo: sostituisce il cobalto
// nello Svizzero, il salvia/terracotta nel Clinico, l'accento saturo
// nell'Industriale, l'oro nel Boutique; nel Fotografico non guida la
// palette (che resta scura per lasciar parlare le foto) ma colora comunque
// i pulsanti di invito.
export const CATEGORY_PRIMARY: Record<Category, string> = {
  ristorante: "#7C2D12",
  bar: "#5B3A29",
  negozio: "#8A6D3B",
  parrucchiere: "#8A6D3B",
  estetista: "#8A6D3B",
  sanitario: "#6E8F5C",
  studio_tecnico: "#1B3FE0",
  veterinario: "#B0662E",
  officina: "#E8B400",
  hotel: "#7C2D12",
  generico: "#1B3FE0",
};

export interface DemoSectionDef {
  key: string;
  label: string;
  description: string;
  defaultOn: boolean;
}

// Ogni sezione qui sotto usa solo dati reali (nome, indirizzo, telefono,
// valutazione, foto) oppure testo dichiaratamente generico e sostituibile —
// mai un fatto inventato su quell'attività specifica.
export const DEMO_SECTIONS: DemoSectionDef[] = [
  { key: "chiSiamo", label: "Chi siamo", description: "Paragrafo di presentazione.", defaultOn: true },
  { key: "galleria", label: "Galleria foto", description: "Le foto reali dell'attività, se disponibili.", defaultOn: true },
  { key: "servizi", label: "Servizi", description: "Elenco esemplificativo dei servizi tipici della categoria, da personalizzare.", defaultOn: false },
  { key: "numeri", label: "Numeri", description: "Valutazione e recensioni Google in evidenza.", defaultOn: false },
  { key: "doveContatti", label: "Dove e contatti", description: "Orari, indirizzo, telefono.", defaultOn: true },
  { key: "mappa", label: "Mappa", description: "Riquadro con l'indirizzo e il link ad aprirlo su Google Maps.", defaultOn: false },
  { key: "recensioni", label: "Recensioni", description: "Le recensioni Google reali, con link a tutte le altre.", defaultOn: true },
  { key: "prenota", label: "Prenota ora", description: "Fascia con la chiamata o il messaggio diretto in evidenza.", defaultOn: false },
  { key: "faq", label: "Domande frequenti", description: "Domande generiche su prenotazione e orari.", defaultOn: false },
  { key: "ctaFinale", label: "Invito finale", description: "Ultimo invito a contattare, prima del footer.", defaultOn: true },
];

export const DEFAULT_SECTION_KEYS: string[] = DEMO_SECTIONS.filter((s) => s.defaultOn).map((s) => s.key);

const VALID_SECTION_KEYS = new Set(DEMO_SECTIONS.map((s) => s.key));

// Se non è stata fatta una scelta esplicita (chiamata diretta all'API, come
// prima del wizard) si usa l'insieme di sempre. Se una scelta c'è — anche
// vuota — si rispetta quella, filtrando solo le chiavi che esistono davvero.
export function resolveSections(selected: string[] | null | undefined): Set<string> {
  if (selected == null) return new Set(DEFAULT_SECTION_KEYS);
  return new Set(selected.filter((k) => VALID_SECTION_KEYS.has(k)));
}

// Il nome del sito che appare nel menu, nel titolo della pagina e nell'hero.
// Se troppo lungo per quegli spazi, si accorcia: prima al primo segmento
// separato da un trattino (frequente nei nomi presi da Google, tipo
// "Metodo Tamburo - Human Performance - Centro Fisioterapia Sicilia"),
// altrimenti a parole intere entro il limite.
export function shortenSiteTitle(name: string, maxLen = 42): string {
  const pulito = (name || "").trim();
  if (pulito.length <= maxLen) return pulito;

  const primoSegmento = pulito.split(/\s+[-–—]\s+/)[0].trim();
  if (primoSegmento.length <= maxLen) return primoSegmento;

  const parole = primoSegmento.split(/\s+/);
  let risultato = "";
  for (const parola of parole) {
    const candidato = risultato ? `${risultato} ${parola}` : parola;
    if (candidato.length > maxLen - 1) break;
    risultato = candidato;
  }
  return (risultato || primoSegmento.slice(0, maxLen - 1)).trim() + "…";
}

interface Shades {
  primary: string;
  deep: string;
  bg: string;
  bg2: string;
  ink: string;
  accent: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Mescola un colore verso il bianco (amount 0-1) o verso il nero (amount negativo).
function mix(hex: string, amount: number, toward: [number, number, number]): string {
  const [r, g, b] = hexToRgb(hex);
  const t = Math.abs(amount);
  return rgbToHex([
    r + (toward[0] - r) * t,
    g + (toward[1] - g) * t,
    b + (toward[2] - b) * t,
  ]);
}

// Da un solo colore scelto a mano ricava l'intera palette della demo: un
// tono più scuro per gli stati attivi, due sfondi chiarissimi, un inchiostro
// quasi nero e un accento caldo neutro che funziona con qualunque primario.
export function deriveShades(hexPrimary: string): Shades {
  const primary = hexPrimary.toLowerCase();
  return {
    primary,
    deep: mix(primary, 0.35, [0, 0, 0]),
    bg: mix(primary, 0.95, [255, 255, 255]),
    bg2: mix(primary, 0.88, [255, 255, 255]),
    ink: mix(primary, 0.15, [0, 0, 0]),
    accent: mix(primary, 0.25, [214, 158, 46]), // verso un oro caldo, mai puramente il primario stesso
  };
}

// Il link "leggi tutte le recensioni". Un placeId vero (quello di Google
// Places) porta alla scheda ufficiale; uno sintetico — generato quando la
// ricerca è avvenuta senza chiave Places, per scraping — inizia sempre con
// "noid-" e non è un id reale: usarlo produrrebbe un link rotto, quindi in
// quel caso, come senza placeId, si ripiega su una ricerca per nome e
// indirizzo, la stessa già usata altrove per "Apri in Google Maps".
export function googleReviewsUrl(input: { placeId?: string | null; name: string; address?: string | null }): string {
  const haveRealPlaceId = !!input.placeId && !input.placeId.startsWith("noid-");
  if (haveRealPlaceId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(input.placeId!)}`;
  }
  const query = [input.name, input.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}
