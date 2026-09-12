// Valuta il sito di un'attività senza aprire un browser: scarica l'HTML e
// applica euristiche. Serve a decidere se l'attività è un LEAD (sito assente
// o scadente) o no.
//
// La soglia è volutamente prudente. Dire "il suo sito è da rifare" a chi ha
// un sito decente brucia il contatto al primo messaggio, quindi un solo
// segnale debole non basta più a bocciare: prima l'assenza del meta viewport
// da sola valeva la condanna, e bastava un sito curato ma vecchio di qualche
// anno per finire nella lista degli "scadenti".

export type WebsiteStatus = "none" | "bad" | "good";

export interface WebsiteJudgement {
  status: WebsiteStatus;
  reasons: string[];
}

// Domini che NON sono un vero sito: solo social, aggregatori, vetrine.
const SOCIAL_ONLY: Array<{ frammento: string; motivo: string }> = [
  { frammento: "facebook.com", motivo: "al posto del sito c'è una pagina Facebook" },
  { frammento: "instagram.com", motivo: "al posto del sito c'è un profilo Instagram" },
  { frammento: "linktr.ee", motivo: "al posto del sito c'è un elenco di link" },
  { frammento: "wa.me", motivo: "al posto del sito c'è un link WhatsApp" },
  { frammento: "business.site", motivo: "ha solo la vetrina automatica di Google" },
  { frammento: "tripadvisor", motivo: "al posto del sito c'è una scheda TripAdvisor" },
  { frammento: "thefork", motivo: "al posto del sito c'è una scheda TheFork" },
  { frammento: "justeat", motivo: "al posto del sito c'è una scheda JustEat" },
  { frammento: "deliveroo", motivo: "al posto del sito c'è una scheda Deliveroo" },
  { frammento: "subito.it", motivo: "al posto del sito c'è un annuncio" },
  { frammento: "paginegialle", motivo: "al posto del sito c'è una scheda PagineGialle" },
  { frammento: "google.com/maps", motivo: "al posto del sito c'è la scheda Google Maps" },
];

const SOGLIA_BOCCIATURA = 3;

/**
 * Il giudizio vero e proprio, separato dalla rete così è verificabile.
 * `reachable: false` significa "non risponde".
 */
export function judgeWebsite(input: {
  url: string;
  reachable: boolean;
  httpStatus?: number;
  html?: string | null;
  finalUrl?: string;
}): WebsiteJudgement {
  const reasons: string[] = [];

  if (!input.reachable) {
    return { status: "bad", reasons: ["il sito non risponde o ha il certificato scaduto"] };
  }
  if (input.httpStatus && input.httpStatus >= 400) {
    return { status: "bad", reasons: [`il sito risponde con un errore ${input.httpStatus}`] };
  }

  const html = input.html || "";
  const lc = html.toLowerCase();
  let punti = 0;

  const aggiungi = (p: number, motivo: string) => {
    punti += p;
    reasons.push(motivo);
  };

  if (!lc.includes('name="viewport"') && !lc.includes("name='viewport'")) {
    aggiungi(2, "non è adattato al telefono (manca il meta viewport)");
  }
  if ((input.finalUrl || input.url).startsWith("http://")) {
    aggiungi(2, "non usa HTTPS: il browser lo segnala come non sicuro");
  }
  if (lc.includes("sito in costruzione") || lc.includes("coming soon") || lc.includes("under construction")) {
    aggiungi(4, "è una pagina in costruzione");
  }
  if (
    lc.includes("apache2 ubuntu default") ||
    lc.includes("welcome to nginx") ||
    lc.includes("default web page") ||
    lc.includes("index of /")
  ) {
    aggiungi(4, "mostra la pagina predefinita del server, non un sito");
  }
  if (html.length < 1200) {
    aggiungi(3, "la pagina è quasi vuota");
  } else if (html.length < 3000) {
    aggiungi(1, "la pagina ha pochissimo contenuto");
  }
  if (lc.includes("<frameset") || lc.includes("<frame ")) {
    aggiungi(3, "è costruito con i frame, una tecnica abbandonata da vent'anni");
  }
  if (!/<title[^>]*>\s*\S/.test(lc)) {
    aggiungi(1, "non ha un titolo: su Google appare senza nome");
  }
  if (/<(font|center|marquee|blink)\b/.test(lc)) {
    aggiungi(2, "usa tag HTML deprecati da tempo");
  }

  // Un sito fermo da anni: cerchiamo l'anno di copyright più recente.
  const anni = [...lc.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,20}((?:19|20)\d{2})/g)].map((m) => Number(m[1]));
  if (anni.length) {
    const ultimo = Math.max(...anni);
    const oggi = new Date().getFullYear();
    if (oggi - ultimo >= 4) {
      aggiungi(2, `sembra fermo dal ${ultimo}`);
    }
  }

  if (punti >= SOGLIA_BOCCIATURA) return { status: "bad", reasons };
  return { status: "good", reasons };
}

export async function checkWebsiteDetailed(website: string | null | undefined): Promise<WebsiteJudgement> {
  if (!website || !website.trim()) return { status: "none", reasons: ["non risulta nessun sito"] };

  const lower = website.toLowerCase();
  const social = SOCIAL_ONLY.find((s) => lower.includes(s.frammento));
  if (social) return { status: "bad", reasons: [social.motivo] };

  const url = website.startsWith("http") ? website : `https://${website}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html",
      },
    });
    clearTimeout(t);

    if (!res.ok) return judgeWebsite({ url, reachable: true, httpStatus: res.status, finalUrl: res.url });
    const html = (await res.text()).slice(0, 200_000);
    return judgeWebsite({ url, reachable: true, httpStatus: res.status, html, finalUrl: res.url || url });
  } catch {
    return judgeWebsite({ url, reachable: false });
  }
}

/** Solo lo stato, per chi non ha bisogno di sapere il perché. */
export async function checkWebsite(website: string | null | undefined): Promise<WebsiteStatus> {
  return (await checkWebsiteDetailed(website)).status;
}
