// Le foto di Google Places si scaricano solo presentando la chiave API. Se
// la chiave finisce dentro l'URL della foto, e quell'URL viene scritto nella
// demo pubblica, chiunque apra la demo può leggerla dal sorgente e
// consumare il credito. Quindi: nel database e nell'HTML finisce sempre e
// solo un indirizzo del nostro proxy, e la chiave resta sul server.

// Forma del riferimento restituito da Places: places/<id>/photos/<ref>.
// Il proxy accetta solo questa forma, così non può essere trasformato in
// un modo per far scaricare al server un indirizzo qualunque.
const PHOTO_REF_RE = /^places\/[A-Za-z0-9_-]{1,256}\/photos\/[A-Za-z0-9_-]{1,1024}$/;

export const PHOTO_MAX_W = 1600;
export const PHOTO_MAX_H = 900;

export function isValidPhotoRef(ref: string): boolean {
  return PHOTO_REF_RE.test(ref);
}

/** Indirizzo interno da salvare al posto dell'URL diretto di Google. */
export function photoProxyUrl(ref: string, w = PHOTO_MAX_W, h = PHOTO_MAX_H): string {
  return `/api/photo?ref=${encodeURIComponent(ref)}&w=${w}&h=${h}`;
}

/** Indirizzo vero di Google, costruito solo lato server al momento di servire. */
export function placesMediaUrl(ref: string, apiKey: string, w = PHOTO_MAX_W, h = PHOTO_MAX_H): string {
  return `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=${h}&maxWidthPx=${w}&key=${encodeURIComponent(apiKey)}`;
}

/**
 * Ripulisce un URL di foto già salvato. Serve per le righe scritte prima
 * che il proxy esistesse: quelle contengono la chiave in chiaro e vanno
 * riscritte, non semplicemente accettate.
 *
 * - URL media di Places (con o senza chiave) -> indirizzo del proxy
 * - altro URL con un parametro `key` -> stesso URL senza quel parametro
 * - tutto il resto (per esempio le foto raccolte dallo scraper) -> invariato
 */
export function sanitizePhotoUrl(raw: string): string | null {
  const url = (raw || "").trim();
  if (!url) return null;

  // Gia' passato dal proxy: lascialo stare.
  if (url.startsWith("/api/photo?")) return url;

  if (!/^https?:\/\//i.test(url)) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname === "places.googleapis.com") {
    // /v1/places/<id>/photos/<ref>/media
    const m = parsed.pathname.match(/^\/v1\/(places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+)\/media$/);
    if (m && isValidPhotoRef(m[1])) {
      const w = Number(parsed.searchParams.get("maxWidthPx")) || PHOTO_MAX_W;
      const h = Number(parsed.searchParams.get("maxHeightPx")) || PHOTO_MAX_H;
      return photoProxyUrl(m[1], w, h);
    }
    // Un indirizzo di Places che non riconosciamo e che porta con se' una
    // chiave: meglio perdere la foto che pubblicare la chiave.
    if (parsed.searchParams.has("key")) return null;
    return url;
  }

  if (parsed.searchParams.has("key")) {
    parsed.searchParams.delete("key");
    return parsed.toString();
  }

  return url;
}

/** Ripulisce una lista intera, scartando le foto non recuperabili. */
export function sanitizePhotoList(raw: string[]): string[] {
  const out: string[] = [];
  for (const p of raw || []) {
    const clean = sanitizePhotoUrl(p);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}
