// Logica dietro il wizard di generazione demo: stile visivo, sezioni
// opzionali, titolo del sito, colore primario, link alle recensioni. Tutto
// puro: nessun accesso al database, così è testabile senza un server acceso
// e riusabile sia lato server (generazione) sia lato client (wizard).

import type { Category } from "./types";

export type DemoStyleKey = "standard" | "moderno" | "bilanciato" | "editoriale" | "vivace";

// Colore primario di partenza per categoria, da proporre nel wizard come
// suggerimento già coerente col resto della demo (che poi l'utente può
// cambiare). Duplica solo l'esadecimale "primary" di PALETTES in
// demoGenerator.ts — tenerli allineati se una palette cambia là, perché
// questo file resta leggero e senza dipendenze per poter girare anche lato
// client, dentro il wizard.
export const CATEGORY_PRIMARY: Record<Category, string> = {
  ristorante: "#7C2D12",
  bar: "#5B3A29",
  negozio: "#1E3A5F",
  parrucchiere: "#3D2C4A",
  estetista: "#9D5C63",
  sanitario: "#2F6F62",
  studio_tecnico: "#1F3A4D",
  veterinario: "#3D6B4F",
  officina: "#1F2937",
  hotel: "#234E52",
  generico: "#334155",
};

export interface DemoStyleDef {
  key: DemoStyleKey;
  label: string;
  description: string;
}

// Standard e Moderno sono i due estremi chiesti esplicitamente: fermo contro
// pieno di movimento. Bilanciato sta in mezzo. Editoriale e Vivace sono le
// due aggiunte: la prima per chi vende credibilità (studi tecnici, sanitari:
// lo diceva anche lo studio di mercato — "qui l'eleganza è credibilità"), la
// seconda per chi vende energia (ristoranti, bar, estetisti, parrucchieri).
export const DEMO_STYLES: DemoStyleDef[] = [
  { key: "standard", label: "Standard", description: "Pulito e diretto: un piccolo effetto di comparsa allo scroll, niente di più. La scelta giusta quando il contenuto deve parlare da solo." },
  { key: "moderno", label: "Moderno", description: "Transizioni ampie, immagini che scalano, sfondo che si muove con lo scroll. L'effetto \"wow\" al primo sguardo." },
  { key: "bilanciato", label: "Bilanciato", description: "Via di mezzo: movimento visibile ma misurato, senza appesantire la lettura." },
  { key: "editoriale", label: "Editoriale", description: "Tipografia grande, spazi ampi, quasi nessuna animazione. Per chi vende fiducia più che entusiasmo." },
  { key: "vivace", label: "Vivace", description: "Colori decisi, forme arrotondate, piccoli rimbalzi sui pulsanti. Per un'attività che vuole trasmettere energia." },
];

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
