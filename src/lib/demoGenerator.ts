import type { Category, Review, OpeningPeriod } from "./types";
import { CATEGORY_LABEL } from "./category";
import { escapeHtml, normalizePhoneIt } from "./utils";
import { resolveSections, deriveShades, googleReviewsUrl, type DemoStyleKey } from "./demoOptions";

// Genera un sito demo completo (HTML standalone, CSS inline, mobile-first)
// popolato con i dati REALI dell'attivita. Stile derivato dai template "Sito in 48 ore".
//
// Il wizard (vedi demoOptions.ts) sceglie stile visivo, sezioni opzionali,
// titolo del sito, colore primario e modalità del menu. Nessuno di questi
// parametri è obbligatorio: chiamata senza opzioni, la funzione si comporta
// come prima del wizard (compatibilità con generazioni già fatte).

interface Palette {
  primary: string;
  deep: string;
  bg: string;
  bg2: string;
  ink: string;
  accent: string;
  serif: string;
}

const PALETTES: Record<Category, Palette> = {
  ristorante: { primary: "#7C2D12", deep: "#5C1F0A", bg: "#FAF3E7", bg2: "#F1E4CE", ink: "#2B1D14", accent: "#C8862A", serif: "Georgia,'Times New Roman',serif" },
  bar: { primary: "#5B3A29", deep: "#3F271A", bg: "#FBF6EF", bg2: "#F0E6D8", ink: "#2A1C12", accent: "#B07B3E", serif: "Georgia,serif" },
  negozio: { primary: "#1E3A5F", deep: "#13263F", bg: "#F6F8FB", bg2: "#E8EEF5", ink: "#1A2332", accent: "#C2410C", serif: "Georgia,serif" },
  parrucchiere: { primary: "#3D2C4A", deep: "#281C32", bg: "#FAF7FB", bg2: "#EFE8F2", ink: "#241A2C", accent: "#B08968", serif: "Georgia,serif" },
  estetista: { primary: "#9D5C63", deep: "#7A444A", bg: "#FCF6F5", bg2: "#F6E8E7", ink: "#3A2528", accent: "#C99CA0", serif: "Georgia,serif" },
  // Verde salvia calmo, non il blu-clinico da ospedale: rassicura senza essere freddo.
  sanitario: { primary: "#2F6F62", deep: "#1F4A40", bg: "#F6FAF8", bg2: "#E7F1EC", ink: "#1B2E29", accent: "#C9A227", serif: "Georgia,serif" },
  // Stessa palette di prima (era "studio_professionale"): sobria, poco satura,
  // perche' qui l'eleganza e' credibilita', non attrattiva.
  studio_tecnico: { primary: "#1F3A4D", deep: "#142836", bg: "#F5F8FA", bg2: "#E6EEF2", ink: "#16242E", accent: "#2C7A7B", serif: "Georgia,serif" },
  // Verde bosco caldo con accento ambra: l'accento serve a far risaltare la
  // chiamata per le urgenze, il dato che conta di piu' per questa categoria.
  veterinario: { primary: "#3D6B4F", deep: "#294A36", bg: "#F7FAF5", bg2: "#E9F1E4", ink: "#223424", accent: "#D9772E", serif: "Georgia,serif" },
  officina: { primary: "#1F2937", deep: "#111827", bg: "#F4F5F7", bg2: "#E5E7EB", ink: "#111827", accent: "#EA580C", serif: "system-ui,sans-serif" },
  hotel: { primary: "#234E52", deep: "#163438", bg: "#F4F9F8", bg2: "#E2F0EE", ink: "#16292B", accent: "#B7791F", serif: "Georgia,serif" },
  generico: { primary: "#334155", deep: "#1E293B", bg: "#F6F7F9", bg2: "#E8EBEF", ink: "#1E293B", accent: "#0369A1", serif: "Georgia,serif" },
};

// Esempi di servizi per categoria: sono illustrativi e vanno dichiarati come
// tali nella pagina — mai presentati come un fatto accertato su quella
// attività specifica, che non conosciamo.
const CATEGORY_SERVICES: Record<Category, string[]> = {
  ristorante: ["Menù del giorno", "Piatti della tradizione", "Menù per gruppi ed eventi", "Consegna a domicilio"],
  bar: ["Colazioni", "Pausa pranzo", "Aperitivo", "Caffetteria"],
  negozio: ["Prodotti selezionati", "Consulenza personalizzata", "Ordini su richiesta", "Confezione regalo"],
  parrucchiere: ["Taglio e piega", "Colore", "Trattamenti ricostruttivi", "Acconciature per eventi"],
  estetista: ["Trattamenti viso", "Trattamenti corpo", "Manicure e pedicure", "Percorsi benessere"],
  sanitario: ["Prima visita", "Trattamenti personalizzati", "Percorsi di riabilitazione", "Consulenza specialistica"],
  studio_tecnico: ["Consulenza iniziale", "Pratiche e adempimenti", "Assistenza continuativa", "Soluzioni su misura"],
  veterinario: ["Visite di controllo", "Vaccinazioni", "Interventi chirurgici", "Urgenze"],
  officina: ["Tagliandi e revisioni", "Diagnosi e riparazioni", "Preventivi gratuiti", "Ricambi originali"],
  hotel: ["Camere per ogni esigenza", "Colazione inclusa", "Soggiorni di lavoro o vacanza", "Servizi su richiesta"],
  generico: ["Consulenza personalizzata", "Servizi su misura", "Assistenza diretta", "Preventivi su richiesta"],
};

// Parametri di movimento per ognuno dei 5 stili. Sono variabili CSS, non
// blocchi di stile separati: così un solo set di regole `.reveal` si adatta
// a tutti e cinque, e aggiungere un sesto stile in futuro è una riga, non
// una nuova sezione di CSS duplicata.
interface StyleTuning {
  duration: string;
  ease: string;
  distance: string; // quanto si sposta in verticale comparendo
  scaleFrom: string; // da quale scala parte (1 = nessuno zoom)
  radius: string; // raggio degli angoli di bottoni e schede
  parallax: boolean; // sfondo dell'hero che si muove con lo scroll
  bounce: boolean; // piccolo rimbalzo al passaggio del mouse sui pulsanti
}

const STYLE_TUNING: Record<DemoStyleKey, StyleTuning> = {
  standard: { duration: ".6s", ease: "cubic-bezier(.16,1,.3,1)", distance: "14px", scaleFrom: "1", radius: "7px", parallax: false, bounce: false },
  moderno: { duration: ".9s", ease: "cubic-bezier(.19,1,.22,1)", distance: "36px", scaleFrom: ".94", radius: "16px", parallax: true, bounce: false },
  bilanciato: { duration: ".7s", ease: "cubic-bezier(.22,1,.36,1)", distance: "20px", scaleFrom: ".98", radius: "10px", parallax: false, bounce: false },
  editoriale: { duration: ".5s", ease: "ease-out", distance: "0px", scaleFrom: "1", radius: "2px", parallax: false, bounce: false },
  vivace: { duration: ".55s", ease: "cubic-bezier(.34,1.56,.64,1)", distance: "22px", scaleFrom: ".9", radius: "999px", parallax: false, bounce: true },
};

export interface DemoInput {
  name: string;
  category: Category;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  placeId?: string | null; // per il link "leggi tutte le recensioni"
  rating?: number | null;
  reviewCount?: number;
  photos: string[];
  hours: OpeningPeriod[] | null;
  topReviews: Review[];
  copy: string; // testo di presentazione (AI o fallback)
  // dati del venditore per la CTA commerciale (banner in alto e footer)
  sellerName: string;
  sellerWa?: string | null; // numero del venditore in formato wa.me
  priceLine: string;

  // Scelte del wizard: tutte opzionali, con un comportamento di prima quando assenti.
  style?: DemoStyleKey; // default "standard"
  sections?: string[] | null; // default: l'insieme di sempre (vedi demoOptions.ts)
  siteTitle?: string | null; // default: input.name
  menuMode?: "completo" | "solo-contatti"; // default "completo"
  primaryColor?: string | null; // se presente, l'intera palette si ricava da qui
}

function stars(n: number): string {
  const full = Math.round(n);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

export function generateDemoHtml(input: DemoInput): string {
  const basePalette = PALETTES[input.category] || PALETTES.generico;
  const p: Palette = input.primaryColor
    ? { ...basePalette, ...deriveShades(input.primaryColor) }
    : basePalette;

  const style = input.style || "standard";
  const tuning = STYLE_TUNING[style];
  const sections = resolveSections(input.sections);
  const menuCompleto = input.menuMode !== "solo-contatti";

  const displayName = (input.siteTitle || "").trim() || input.name;
  const name = escapeHtml(displayName);
  const city = escapeHtml(input.city || "");
  const address = escapeHtml(input.address || "");
  const label = CATEGORY_LABEL[input.category];
  const wa = normalizePhoneIt(input.phone);
  const tel = input.phone ? input.phone.replace(/[^\d+]/g, "") : "";
  const sellerWa = input.sellerWa;

  const hero = input.photos[0] || "";
  const gallery = input.photos.slice(1, 4);

  const waBusinessHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Buongiorno ${displayName}, vorrei informazioni`)}`
    : "";

  // Per un veterinario, in un'emergenza si chiama, non si scrive. Diamo
  // priorita' alla telefonata solo se il numero c'e' davvero: nessuna
  // promessa di reperibilita' che non conosciamo, solo il dato reale messo
  // nel punto giusto.
  const phoneFirst = input.category === "veterinario" && !!tel;

  const sellerHref = sellerWa
    ? `https://wa.me/${sellerWa}?text=${encodeURIComponent(`Ciao! Ho visto la demo del sito per ${displayName}, mi interessa`)}`
    : "#contatti-venditore";

  const contattaHeaderBtn = phoneFirst
    ? `<a class="btn" href="tel:${tel}">Chiama ora</a>`
    : waBusinessHref
      ? `<a class="btn" href="${waBusinessHref}">Contattaci</a>`
      : tel
        ? `<a class="btn" href="tel:${tel}">Chiama</a>`
        : "";

  const contattaHeroBtn = phoneFirst
    ? `<a class="btn btn-accent" href="tel:${tel}">Chiamaci ora</a>`
    : waBusinessHref
      ? `<a class="btn btn-accent" href="${waBusinessHref}">Scrivici su WhatsApp</a>`
      : tel
        ? `<a class="btn btn-accent" href="tel:${tel}">Chiamaci ora</a>`
        : "";

  const hoursRows = (input.hours || [])
    .map((h) => `<tr><td>${escapeHtml(h.day)}</td><td>${escapeHtml(h.hours) || "—"}</td></tr>`)
    .join("");

  const reviewsUrl = googleReviewsUrl({ placeId: input.placeId, name: input.name, address: input.address });

  const reviewsHtml = input.topReviews
    .map(
      (r) => `
      <div class="review reveal">
        <div class="stars" aria-hidden="true">${stars(r.rating)}</div>
        <p>${escapeHtml(r.text)}</p>
        <footer>${escapeHtml(r.author)} · recensione Google</footer>
      </div>`
    )
    .join("");

  const heroStyle = hero
    ? `background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.62)),url('${escapeHtml(hero)}') center/cover`
    : `background:linear-gradient(160deg,${p.primary} 0%,${p.deep} 70%)`;

  // ── Sezioni opzionali: ognuna è stringa vuota se disattivata o senza dati ──

  const chiSiamoHtml = sections.has("chiSiamo")
    ? `<section id="chi" class="wrap">
        <p class="kicker reveal">Chi siamo</p>
        <h2 class="reveal">Benvenuti da ${name}</h2>
        <p class="intro reveal">${escapeHtml(input.copy)}</p>
      </section>`
    : "";

  const galleriaHtml = sections.has("galleria") && gallery.length
    ? `<section id="galleria" class="alt"><div class="wrap">
        <p class="kicker reveal">Galleria</p>
        <h2 class="reveal">Uno sguardo da ${name}</h2>
        <div class="gallery">${gallery.map((src) => `<img loading="lazy" src="${escapeHtml(src)}" alt="${name}">`).join("")}</div>
      </div></section>`
    : "";

  const serviziHtml = sections.has("servizi")
    ? `<section id="servizi" class="wrap">
        <p class="kicker reveal">Servizi</p>
        <h2 class="reveal">Cosa potete trovare qui</h2>
        <p class="intro reveal">Alcuni esempi tipici della categoria — da sostituire con i servizi reali di ${name}.</p>
        <ul class="services reveal">
          ${CATEGORY_SERVICES[input.category].map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      </section>`
    : "";

  const numeriHtml = sections.has("numeri") && input.rating
    ? `<section id="numeri" class="alt"><div class="wrap">
        <div class="stats">
          <div class="stat reveal"><div class="n">${input.rating.toFixed(1)}</div><div class="l">valutazione media</div></div>
          <div class="stat reveal"><div class="n">${input.reviewCount}</div><div class="l">recensioni su Google</div></div>
        </div>
      </div></section>`
    : "";

  const doveContattiHtml = sections.has("doveContatti")
    ? `<section id="dove" class="wrap">
        <p class="kicker reveal">Orari e contatti</p>
        <h2 class="reveal">Dove e quando trovarci</h2>
        <div class="info-grid">
          ${hoursRows ? `<div class="card reveal"><h3>Orari di apertura</h3><table>${hoursRows}</table></div>` : ""}
          <div class="card reveal">
            <h3>Contatti</h3>
            ${address ? `<p style="margin-bottom:8px"><b>${address}</b></p>` : ""}
            ${input.phone ? `<p>Tel: <a href="tel:${tel}"><b>${escapeHtml(input.phone)}</b></a></p>` : ""}
          </div>
          ${
            input.rating
              ? `<div class="card reveal"><h3>Su Google</h3><div class="ratingbig"><div class="num">${input.rating.toFixed(1)}</div><div class="st">${stars(input.rating)}</div><p style="margin-top:8px">${input.reviewCount} recensioni</p></div></div>`
              : ""
          }
        </div>
      </section>`
    : "";

  const mappaHtml = sections.has("mappa") && address
    ? `<section id="mappa" class="alt"><div class="wrap">
        <p class="kicker reveal">Come arrivare</p>
        <h2 class="reveal">${address}</h2>
        <p class="intro reveal">Un indirizzo, una mappa: chi cerca ${name} lo trova senza dover chiedere.</p>
        <a class="btn reveal" href="https://www.google.com/maps/search/${encodeURIComponent(input.name + " " + (input.address || ""))}" target="_blank" rel="noopener">Apri in Google Maps →</a>
      </div></section>`
    : "";

  const recensioniHtml = sections.has("recensioni") && (reviewsHtml || input.rating)
    ? `<section id="recensioni" class="alt"><div class="wrap">
        <p class="kicker reveal">Dicono di noi</p>
        <h2 class="reveal">Le recensioni dei clienti</h2>
        ${reviewsHtml ? `<div class="reviews">${reviewsHtml}</div>` : ""}
        <p class="reveal" style="margin-top:22px"><a href="${reviewsUrl}" target="_blank" rel="noopener">Leggi tutte le recensioni su Google →</a></p>
      </div></section>`
    : "";

  const prenotaHtml = sections.has("prenota") && (waBusinessHref || tel)
    ? `<section id="prenota" class="wrap">
        <div class="cta reveal">
          <h2>Fissa un appuntamento</h2>
          <p>Bastano trenta secondi: scriva o chiami, e organizziamo insieme.</p>
          ${waBusinessHref ? `<a class="btn btn-accent" href="${waBusinessHref}">Scrivici su WhatsApp</a>` : ""}
          ${input.phone ? `<span class="tel">oppure chiama: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></span>` : ""}
        </div>
      </section>`
    : "";

  const faqHtml = sections.has("faq")
    ? `<section id="faq" class="alt"><div class="wrap">
        <p class="kicker reveal">Domande frequenti</p>
        <h2 class="reveal">Le domande più comuni</h2>
        <div class="faq">
          <div class="faq-item reveal"><h3>Come posso mettermi in contatto?</h3><p>${waBusinessHref || tel ? `Il modo più rapido è scrivere o chiamare: risponde direttamente ${name}.` : "Trova tutti i recapiti nella sezione contatti qui sopra."}</p></div>
          <div class="faq-item reveal"><h3>Devo prenotare prima di venire?</h3><p>Conviene chiamare o scrivere prima, così si evita di trovare tutto occupato.</p></div>
          <div class="faq-item reveal"><h3>Dove vi trovo esattamente?</h3><p>${address ? "L'indirizzo e la mappa sono qui sopra, nella sezione dedicata." : "Chieda l'indirizzo esatto scrivendo o chiamando."}</p></div>
        </div>
      </div></section>`
    : "";

  const ctaFinaleHtml = sections.has("ctaFinale")
    ? `<section class="wrap">
        <div class="cta reveal">
          <h2>${input.category === "ristorante" || input.category === "bar" ? "Vieni a trovarci" : "Mettiti in contatto"}</h2>
          <p>Un messaggio e ti rispondiamo subito negli orari di apertura.</p>
          ${waBusinessHref ? `<a class="btn btn-accent" href="${waBusinessHref}">Scrivici su WhatsApp</a>` : ""}
          ${input.phone ? `<span class="tel">oppure chiama: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></span>` : ""}
        </div>
      </section>`
    : "";

  // Ordine di lettura della pagina.
  const mainSections = [chiSiamoHtml, serviziHtml, galleriaHtml, numeriHtml, doveContattiHtml, mappaHtml, recensioniHtml, prenotaHtml, faqHtml, ctaFinaleHtml]
    .filter(Boolean)
    .join("\n");

  // Il menu riprende solo le sezioni che sono davvero finite in pagina.
  const navLinks = menuCompleto
    ? [
        chiSiamoHtml && '<a href="#chi">Chi siamo</a>',
        serviziHtml && '<a href="#servizi">Servizi</a>',
        galleriaHtml && '<a href="#galleria">Galleria</a>',
        doveContattiHtml && '<a href="#dove">Dove siamo</a>',
        recensioniHtml && '<a href="#recensioni">Recensioni</a>',
      ]
        .filter(Boolean)
        .join("\n      ")
    : "";

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${city ? ` — ${city}` : ""} | Demo sito</title>
<meta name="description" content="${name}: ${escapeHtml(input.copy).slice(0, 150)}">
<meta name="robots" content="noindex">
<style>
  :root{
    --primary:${p.primary};--deep:${p.deep};--bg:${p.bg};--bg2:${p.bg2};
    --ink:${p.ink};--accent:${p.accent};
    --serif:${p.serif};--sans:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    --dur:${tuning.duration};--ease:${tuning.ease};--dist:${tuning.distance};--scale0:${tuning.scaleFrom};--radius:${tuning.radius};
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:var(--serif);background:var(--bg);color:var(--ink);line-height:1.7;font-size:17px}
  .wrap{max-width:1000px;margin:0 auto;padding:0 22px}
  a{color:var(--primary)}
  img{max-width:100%;display:block}
  /* banner venditore (commerciale) */
  .sell{background:var(--ink);color:#fff;font-family:var(--sans);font-size:.84rem;text-align:center;padding:10px 14px;position:sticky;top:0;z-index:60}
  .sell a{color:var(--accent);font-weight:700;text-decoration:none}
  /* header */
  header{background:var(--bg);border-bottom:1px solid var(--bg2);position:sticky;top:0;z-index:40}
  .nav{display:flex;align-items:center;justify-content:space-between;padding:15px 0;gap:10px}
  .logo .name{font-size:1.25rem;font-weight:700}
  .logo .tag{display:block;font-family:var(--sans);font-size:.66rem;letter-spacing:.2em;text-transform:uppercase;color:var(--primary)}
  .nav nav{display:flex;gap:18px;font-family:var(--sans);font-size:.9rem}
  .nav nav a{text-decoration:none;color:var(--ink)}
  .btn{display:inline-block;font-family:var(--sans);font-weight:600;text-decoration:none;padding:12px 22px;border-radius:var(--radius);background:var(--primary);color:#fff;border:1px solid var(--primary);transition:background .15s,transform .15s}
  .btn:hover{background:var(--deep)}
  ${tuning.bounce ? ".btn:hover{transform:translateY(-3px)}" : ""}
  .btn-accent{background:var(--accent);border-color:var(--accent);color:var(--ink)}
  /* hero */
  .hero{position:relative;overflow:hidden;color:#fff;padding:110px 0 96px;text-align:left}
  .hero-bg{position:absolute;inset:-10% 0 -10%;${heroStyle};z-index:0}
  .hero .wrap{position:relative;z-index:1}
  .hero .eyebrow{font-family:var(--sans);letter-spacing:.22em;text-transform:uppercase;font-size:.74rem;color:#fff;opacity:.9;margin-bottom:16px}
  .hero h1{font-size:clamp(2.3rem,6vw,4rem);line-height:1.05;font-weight:700;max-width:18ch;text-shadow:0 2px 18px rgba(0,0,0,.3)}
  .hero p{font-family:var(--sans);margin:20px 0 30px;max-width:54ch;font-size:1.08rem;text-shadow:0 1px 10px rgba(0,0,0,.35)}
  .hero-meta{font-family:var(--sans);font-size:.88rem;display:flex;gap:22px;flex-wrap:wrap;margin-top:30px}
  /* sezioni */
  section{padding:70px 0}
  .kicker{font-family:var(--sans);letter-spacing:.18em;text-transform:uppercase;font-size:.72rem;color:var(--primary);margin-bottom:10px}
  h2{font-size:clamp(1.7rem,4vw,2.4rem);line-height:1.12;margin-bottom:14px;font-weight:700}
  .intro{font-family:var(--sans);color:#55514c;max-width:60ch;margin-bottom:34px;font-size:1.02rem}
  .alt{background:var(--bg2)}
  /* servizi */
  .services{list-style:none;font-family:var(--sans);display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
  .services li{background:#fff;border:1px solid var(--bg2);border-radius:var(--radius);padding:16px 20px;font-weight:600}
  /* numeri */
  .stats{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;text-align:center}
  .stats .stat{font-family:var(--sans)}
  .stats .n{font-size:3rem;font-weight:800;color:var(--primary);line-height:1}
  .stats .l{color:#55514c;margin-top:6px}
  /* gallery */
  .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:28px}
  .gallery img{border-radius:var(--radius);height:240px;object-fit:cover;width:100%;transition:transform .35s ease}
  .gallery img:hover{transform:scale(1.03)}
  /* info */
  .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;margin-top:30px}
  .card{background:#fff;border:1px solid var(--bg2);border-radius:var(--radius);padding:26px}
  .card h3{font-size:1.05rem;margin-bottom:12px;color:var(--primary)}
  .card table{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:.92rem}
  .card td{padding:5px 0;vertical-align:top}
  .card td:last-child{text-align:right;font-weight:600}
  .card p{font-family:var(--sans);font-size:.95rem;color:#55514c}
  .ratingbig{font-family:var(--sans)}
  .ratingbig .num{font-size:2.4rem;font-weight:800;color:var(--primary)}
  .ratingbig .st{color:var(--accent);letter-spacing:3px;font-size:1.1rem}
  /* reviews */
  .reviews{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;margin-top:30px}
  .review{background:#fff;border:1px solid var(--bg2);border-radius:var(--radius);padding:24px}
  .review .stars{color:var(--accent);letter-spacing:3px;margin-bottom:10px}
  .review p{font-style:italic;font-size:1rem;line-height:1.55}
  .review footer{font-family:var(--sans);font-size:.82rem;color:#7a756e;margin-top:12px}
  /* faq */
  .faq{display:grid;gap:16px;margin-top:22px}
  .faq-item{background:#fff;border:1px solid var(--bg2);border-radius:var(--radius);padding:20px 24px}
  .faq-item h3{font-size:1rem;color:var(--primary);margin-bottom:6px}
  .faq-item p{font-family:var(--sans);font-size:.95rem;color:#55514c}
  /* cta */
  .cta{background:var(--primary);color:#fff;text-align:center;border-radius:var(--radius);padding:54px 28px;margin:0 22px}
  .cta h2{color:#fff}
  .cta p{font-family:var(--sans);max-width:48ch;margin:0 auto 26px;opacity:.92}
  .cta .tel{display:block;margin-top:16px;font-family:var(--sans);font-size:.92rem;opacity:.92}
  .cta .tel a{color:#fff;font-weight:700;text-decoration:none}
  footer.site{padding:34px 0;font-family:var(--sans);font-size:.82rem;color:#7a756e}
  footer.site .row{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;border-top:1px solid var(--bg2);padding-top:20px}
  .vend{background:var(--ink);color:#fff;font-family:var(--sans);text-align:center;padding:40px 22px}
  .vend h3{font-size:1.3rem;margin-bottom:10px}
  .vend p{opacity:.85;max-width:46ch;margin:0 auto 18px;font-size:.95rem}
  .vend .btn{background:var(--accent);border-color:var(--accent);color:var(--ink)}
  .reveal{opacity:0;transform:translateY(var(--dist)) scale(var(--scale0));transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease)}
  .reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}.hero-bg{transform:none!important}}
  @media (max-width:760px){.nav nav{display:none}section{padding:50px 0}.hero{padding:80px 0 64px}}
</style>
</head>
<body data-style="${style}">

<div class="sell">⚡ Demo realizzata per <b>${name}</b> · La vuoi davvero online in 48h? ${
    sellerWa
      ? `<a href="${sellerHref}">Scrivimi su WhatsApp →</a>`
      : `<a href="#vend">Scopri come →</a>`
  }</div>

<header>
  <div class="wrap nav">
    <div class="logo">
      <span class="name">${name}</span>
      <span class="tag">${escapeHtml(label)}${city ? ` · ${city}` : ""}</span>
    </div>
    ${navLinks ? `<nav>\n      ${navLinks}\n    </nav>` : ""}
    ${contattaHeaderBtn}
  </div>
</header>

<main>
  <section class="hero">
    <div class="hero-bg" data-parallax="${tuning.parallax ? "1" : "0"}"></div>
    <div class="wrap">
      <p class="eyebrow">${escapeHtml(label)}${city ? ` · ${city}` : ""}</p>
      <h1>${name}</h1>
      <p>${escapeHtml(input.copy)}</p>
      ${contattaHeroBtn}
      <div class="hero-meta">
        ${address ? `<span>📍 ${address}</span>` : ""}
        ${input.phone ? `<span>📞 ${escapeHtml(input.phone)}</span>` : ""}
        ${input.rating ? `<span>⭐ ${input.rating.toFixed(1)} (${input.reviewCount} recensioni)</span>` : ""}
      </div>
    </div>
  </section>

  ${mainSections}
</main>

<footer class="site">
  <div class="wrap row">
    <span><b>${name}</b>${address ? ` · ${address}` : ""}</span>
    <span>Sito demo · nessun cookie, nessun tracciamento</span>
  </div>
</footer>

<div class="vend" id="vend">
  <h3>Questo potrebbe essere il sito di ${name}</h3>
  <p>Demo realizzata da <b>${escapeHtml(input.sellerName)}</b> con i vostri dati reali, presi da Google.
     Sito completo online in 48 ore — ${escapeHtml(input.priceLine)}.</p>
  ${
    sellerWa
      ? `<a class="btn" href="${sellerHref}">Scrivimi su WhatsApp</a>`
      : ""
  }
</div>

<script>
  const io = new IntersectionObserver((es)=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}},{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

  // Solo per lo stile "Moderno": lo sfondo dell'hero si muove più lento
  // dello scroll, il classico effetto di profondità. Nessun effetto se
  // l'utente ha chiesto di ridurre le animazioni.
  const bg = document.querySelector('.hero-bg[data-parallax="1"]');
  if (bg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let raf = null;
    window.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        bg.style.transform = 'translateY(' + Math.min(window.scrollY * 0.25, 120) + 'px)';
        raf = null;
      });
    }, { passive: true });
  }
</script>
</body>
</html>`;
}
