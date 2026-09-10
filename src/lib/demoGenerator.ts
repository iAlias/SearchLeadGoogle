import type { Category, Review, OpeningPeriod } from "./types";
import { CATEGORY_LABEL } from "./category";
import { escapeHtml, normalizePhoneIt } from "./utils";
import { resolveSections, deriveShades, googleReviewsUrl, CATEGORY_PRIMARY, CATEGORY_THEME, DEMO_STYLES, type DemoStyleKey } from "./demoOptions";

// Genera un sito demo completo (HTML standalone, CSS inline, mobile-first)
// popolato con i dati REALI dell'attivita.
//
// Cinque temi, cinque motori di generazione separati — non varianti di uno
// stesso sistema con dei parametri diversi. Ognuno ha la sua palette, la sua
// tipografia, le sue meccaniche di scroll, pensate per la categoria a cui è
// destinato. Il wizard (demoOptions.ts) sceglie tema, sezioni, titolo, colore
// e menu; nessun parametro è obbligatorio.

// Esempi di servizi per categoria: sono illustrativi e vanno dichiarati come
// tali nella pagina — mai presentati come un fatto accertato su quella
// attività specifica, che non conosciamo. Niente prezzi: non li conosciamo,
// e inventarli sarebbe peggio che ometterli.
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
  sellerName: string;
  sellerWa?: string | null; // numero del venditore in formato wa.me
  priceLine: string;

  // Scelte del wizard: tutte opzionali, con un default sensato quando assenti.
  style?: DemoStyleKey; // default: il tema consigliato per la categoria
  sections?: string[] | null; // default: l'insieme di sempre (vedi demoOptions.ts)
  siteTitle?: string | null; // default: input.name
  menuMode?: "completo" | "solo-contatti"; // default "completo"
  primaryColor?: string | null; // se presente, sostituisce l'accento del tema
}

function stars(n: number): string {
  const full = Math.round(n);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

interface ReviewRow { stars: string; text: string; author: string }

interface SharedCtx {
  input: DemoInput;
  name: string;
  city: string;
  address: string;
  label: string;
  tel: string;
  waBusinessHref: string;
  phoneFirst: boolean;
  hoursRows: string;
  reviewsUrl: string;
  reviewsRows: ReviewRow[];
  gallery: string[];
  hero: string;
  sections: Set<string>;
  menuCompleto: boolean;
  sellerHref: string;
}

export function generateDemoHtml(input: DemoInput): string {
  // Una scelta salvata con un nome di tema che non esiste più (per esempio
  // "moderno", dalla versione precedente) ricade sul tema della categoria.
  const style: DemoStyleKey = input.style && DEMO_STYLES.some((s) => s.key === input.style)
    ? input.style
    : CATEGORY_THEME[input.category];
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
  const gallery = input.photos.slice(1, 5);

  const waBusinessHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Buongiorno ${displayName}, vorrei informazioni`)}`
    : "";

  // Per un veterinario, in un'emergenza si chiama, non si scrive. Diamo
  // priorita' alla telefonata solo se il numero c'e' davvero.
  const phoneFirst = input.category === "veterinario" && !!tel;

  const sellerHref = sellerWa
    ? `https://wa.me/${sellerWa}?text=${encodeURIComponent(`Ciao! Ho visto la demo del sito per ${displayName}, mi interessa`)}`
    : "#vend";

  const hoursRows = (input.hours || [])
    .map((h) => `<tr><td>${escapeHtml(h.day)}</td><td>${escapeHtml(h.hours) || "—"}</td></tr>`)
    .join("");

  const reviewsUrl = googleReviewsUrl({ placeId: input.placeId, name: input.name, address: input.address });
  const reviewsRows: ReviewRow[] = input.topReviews.map((r) => ({ stars: stars(r.rating), text: escapeHtml(r.text), author: escapeHtml(r.author) }));

  const ctx: SharedCtx = { input, name, city, address, label, tel, waBusinessHref, phoneFirst, hoursRows, reviewsUrl, reviewsRows, gallery, hero, sections, menuCompleto, sellerHref };

  switch (style) {
    case "clinico": return renderClinico(ctx);
    case "industriale": return renderIndustriale(ctx);
    case "fotografico": return renderFotografico(ctx);
    case "boutique": return renderBoutique(ctx);
    case "svizzero":
    default: return renderSvizzero(ctx);
  }
}

function contattaHref(ctx: SharedCtx): { label: string; href: string } | null {
  if (ctx.phoneFirst) return { label: "Chiama ora", href: `tel:${ctx.tel}` };
  if (ctx.waBusinessHref) return { label: "Contattaci", href: ctx.waBusinessHref };
  if (ctx.tel) return { label: "Chiama", href: `tel:${ctx.tel}` };
  return null;
}

function sellVend(ctx: SharedCtx, tone: { bg: string; fg: string; btnBg: string; btnFg: string }): { banner: string; vend: string } {
  const { input, name, sellerHref } = ctx;
  const banner = `<div style="background:${tone.bg};color:${tone.fg};font-family:system-ui,sans-serif;font-size:.82rem;text-align:center;padding:10px 14px">
    ⚡ Demo realizzata per <b>${name}</b> · La vuoi davvero online in 48h? <a href="${sellerHref}" style="color:${tone.btnBg};font-weight:700;text-decoration:none">Scrivimi su WhatsApp →</a>
  </div>`;
  const vend = `<div id="vend" style="background:${tone.bg};color:${tone.fg};font-family:system-ui,sans-serif;text-align:center;padding:48px 22px">
    <h3 style="font-size:1.3rem;margin-bottom:10px">Questo potrebbe essere il sito di ${name}</h3>
    <p style="opacity:.85;max-width:46ch;margin:0 auto 18px;font-size:.95rem">Demo realizzata da <b>${escapeHtml(input.sellerName)}</b> con i vostri dati reali, presi da Google. Sito completo online in 48 ore — ${escapeHtml(input.priceLine)}.</p>
    <a href="${sellerHref}" style="display:inline-block;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;background:${tone.btnBg};color:${tone.btnFg}">Scrivimi su WhatsApp</a>
  </div>`;
  return { banner, vend };
}

// ═══════════════════════════════════════════════════════════════════════
// 1 · SVIZZERO COBALTO — studi tecnici e legali, consulenti
//
// Cobalto, inchiostro, giallo zolfo. Titolo che si comprime in larghezza con
// lo scroll (font variabile Archivo, asse wdth). Ogni sezione si blocca a
// schermo intero e si trasforma: il testo di apertura si illumina parola per
// parola, i servizi scorrono in orizzontale mentre la pagina scorre in
// verticale, l'header cambia colore in base alla sezione sotto di lui, e al
// passaggio fra sezioni una griglia di quadrati dissolve lo schermo nel
// cobalto. Tutto guidato da requestAnimationFrame — lo scroll comanda, non
// l'orologio. Con `prefers-reduced-motion` il meccanismo si spegne del tutto.
// ═══════════════════════════════════════════════════════════════════════

interface Stage {
  key: string; idx: string; tone: "cobalto" | "inchiostro" | "carta";
  title: string; body: string; track: number; wordLit?: boolean; hscroll?: boolean;
}

function renderSvizzero(ctx: SharedCtx): string {
  const { input, name, city, address, label, tel, waBusinessHref, phoneFirst, hoursRows, reviewsUrl, reviewsRows, gallery, sections, menuCompleto } = ctx;

  const cobalto = input.primaryColor || CATEGORY_PRIMARY.studio_tecnico;
  const cobaltoDeep = input.primaryColor ? deriveShades(input.primaryColor).deep : "#11278C";
  const inchiostro = "#0B0D12", zolfo = "#E8D400", carta = "#F3F1EA";

  const contatta = contattaHref(ctx);
  const contattaBtn = contatta ? `<a class="m-btn" href="${contatta.href}">${contatta.label}</a>` : "";

  const wordSpans = input.copy.split(/\s+/).filter(Boolean).map((w) => `<span class="m-word">${escapeHtml(w)}</span>`).join(" ");

  const stages: Stage[] = [];
  if (sections.has("chiSiamo")) stages.push({ key: "chi", idx: "01", tone: "cobalto", title: "Chi siamo", body: `<p class="m-lead m-lit">${wordSpans}</p>`, track: 220, wordLit: true });
  if (sections.has("servizi")) {
    const cards = CATEGORY_SERVICES[input.category].map((s, i) => `<div class="m-hcard"><span class="m-hnum">${String(i + 1).padStart(2, "0")}</span>${escapeHtml(s)}</div>`).join("");
    stages.push({ key: "servizi", idx: "02", tone: "carta", title: "Servizi", body: `<p class="m-note">Esempi tipici della categoria — da sostituire con i servizi reali di ${name}.</p><div class="m-hscroll"><div class="m-hscroll-track">${cards}</div></div>`, track: 240, hscroll: true });
  }
  if (sections.has("galleria") && gallery.length) stages.push({ key: "galleria", idx: "03", tone: "inchiostro", title: "Galleria", body: `<div class="m-gallery">${gallery.map((src) => `<img loading="lazy" src="${escapeHtml(src)}" alt="${name}">`).join("")}</div>`, track: 180 });
  if (sections.has("numeri") && input.rating) stages.push({ key: "numeri", idx: "04", tone: "cobalto", title: "Numeri", body: `<div class="m-stats"><div><span class="m-bignum">${input.rating.toFixed(1)}</span><span class="m-statlabel">valutazione media</span></div><div><span class="m-bignum">${input.reviewCount}</span><span class="m-statlabel">recensioni su Google</span></div></div>`, track: 160 });
  if (sections.has("doveContatti")) stages.push({ key: "dove", idx: "05", tone: "carta", title: "Dove e quando", body: `<div class="m-two">${hoursRows ? `<table class="m-hours">${hoursRows}</table>` : ""}<div class="m-contactcard">${address ? `<p><b>${address}</b></p>` : ""}${input.phone ? `<p>Tel: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></p>` : ""}</div></div>`, track: 180 });
  if (sections.has("mappa") && address) stages.push({ key: "mappa", idx: "06", tone: "inchiostro", title: address, body: `<p class="m-note">Un indirizzo, una mappa: chi cerca ${name} lo trova senza dover chiedere.</p><a class="m-btn m-btn-zolfo" href="https://www.google.com/maps/search/${encodeURIComponent(input.name + " " + (input.address || ""))}" target="_blank" rel="noopener">Apri in Google Maps →</a>`, track: 160 });
  if (sections.has("recensioni") && (reviewsRows.length || input.rating)) {
    const list = reviewsRows.map((r) => `<div class="m-review"><div class="m-stars">${r.stars}</div><p>${r.text}</p><footer>${r.author}</footer></div>`).join("");
    stages.push({ key: "recensioni", idx: "07", tone: "cobalto", title: "Dicono di noi", body: `${list}<p style="margin-top:18px"><a class="m-link" href="${reviewsUrl}" target="_blank" rel="noopener">Leggi tutte le recensioni su Google →</a></p>`, track: 200 });
  }
  if (sections.has("prenota") && (waBusinessHref || tel)) stages.push({ key: "prenota", idx: "08", tone: "inchiostro", title: "Prenota ora", body: `<p class="m-note">Bastano trenta secondi: scriva o chiami, e organizziamo insieme.</p><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">${waBusinessHref ? `<a class="m-btn m-btn-zolfo" href="${waBusinessHref}">Scrivici su WhatsApp</a>` : ""}${input.phone ? `<span>oppure <a class="m-link" href="tel:${tel}">${escapeHtml(input.phone)}</a></span>` : ""}</div>`, track: 160 });
  if (sections.has("faq")) stages.push({ key: "faq", idx: "09", tone: "carta", title: "Domande frequenti", body: `<div class="m-faqlist"><div class="m-faqitem"><h3>Come posso mettermi in contatto?</h3><p>${waBusinessHref || tel ? `Il modo più rapido è scrivere o chiamare: risponde direttamente ${name}.` : "Trova tutti i recapiti nella sezione contatti."}</p></div><div class="m-faqitem"><h3>Devo prenotare prima di venire?</h3><p>Conviene chiamare o scrivere prima, così si evita di trovare tutto occupato.</p></div><div class="m-faqitem"><h3>Dove vi trovo esattamente?</h3><p>${address ? "L'indirizzo è nella sezione dedicata, qualche passo più su." : "Chieda l'indirizzo esatto scrivendo o chiamando."}</p></div></div>`, track: 180 });
  if (sections.has("ctaFinale")) stages.push({ key: "finale", idx: "10", tone: "cobalto", title: input.category === "ristorante" || input.category === "bar" ? "Vieni a trovarci" : "Mettiti in contatto", body: `<p class="m-note">Un messaggio e ti rispondiamo subito negli orari di apertura.</p><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">${waBusinessHref ? `<a class="m-btn m-btn-zolfo" href="${waBusinessHref}">Scrivici su WhatsApp</a>` : ""}${input.phone ? `<span>oppure <a class="m-link" href="tel:${tel}">${escapeHtml(input.phone)}</a></span>` : ""}</div>`, track: 160 });

  const toneVars: Record<Stage["tone"], string> = { cobalto: "background:var(--cobalto);color:var(--carta)", inchiostro: "background:var(--inchiostro);color:var(--carta)", carta: "background:var(--carta);color:var(--inchiostro)" };
  const stagesHtml = stages.map((s) => `<div class="m-stage" id="stage-${s.key}" data-tone="${s.tone}" data-key="${s.key}" style="height:${s.track}vh"><div class="m-stage-inner" style="${toneVars[s.tone]}"><div class="m-stage-grid" aria-hidden="true"></div><div class="m-stage-content"><span class="m-index">${s.idx}</span><h2 class="m-h2">${escapeHtml(s.title)}</h2><div class="m-body">${s.body}</div></div></div></div>`).join("\n");

  const navLinks = menuCompleto ? stages.filter((s) => ["chi", "servizi", "galleria", "dove", "recensioni"].includes(s.key)).map((s) => `<a href="#stage-${s.key}">${s.idx} ${escapeHtml(s.title)}</a>`).join("\n      ") : "";

  const { banner: sellBanner, vend: vendBlock } = sellVend(ctx, { bg: inchiostro, fg: carta, btnBg: zolfo, btnFg: inchiostro });

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${city ? ` — ${city}` : ""} | Demo sito</title>
<meta name="description" content="${name}: ${escapeHtml(input.copy).slice(0, 150)}">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62.5,400..800;125,400..800&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  :root{--cobalto:${cobalto};--cobalto-deep:${cobaltoDeep};--inchiostro:${inchiostro};--zolfo:${zolfo};--carta:${carta};--wdth:125;--sans:'IBM Plex Mono',ui-monospace,monospace}
  *{box-sizing:border-box;margin:0;padding:0;border-radius:0!important}
  html{background:var(--carta)}
  body{font-family:'Archivo',system-ui,sans-serif;background:var(--carta);color:var(--inchiostro);line-height:1.5;overflow-x:hidden}
  a{color:inherit}
  img{max-width:100%;display:block}
  h1,h2,.m-index,.m-logo,.m-eyebrow{font-variation-settings:'wdth' var(--wdth)}
  .m-progress{position:fixed;top:0;left:0;height:3px;background:var(--zolfo);width:0%;z-index:97;transition:width .05s linear}
  header.m-header{position:sticky;top:0;z-index:90;background:var(--carta);color:var(--inchiostro);border-bottom:1px solid currentColor;transition:background-color .45s ease,color .45s ease}
  header.m-header[data-tone="cobalto"]{background:var(--cobalto);color:var(--carta)}
  header.m-header[data-tone="inchiostro"]{background:var(--inchiostro);color:var(--carta)}
  .m-header-inner{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 6vw}
  .m-logo{font-size:1.15rem;font-weight:700;letter-spacing:-.01em}
  .m-header-inner nav{display:flex;gap:16px;font-family:var(--sans);font-size:.7rem;letter-spacing:.03em;text-transform:uppercase}
  .m-header-inner nav a{text-decoration:none}
  .m-btn{display:inline-block;font-family:var(--sans);font-size:.78rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;text-decoration:none;padding:11px 20px;background:var(--inchiostro);color:var(--carta);border:1px solid var(--inchiostro)}
  header.m-header[data-tone="cobalto"] .m-btn,header.m-header[data-tone="inchiostro"] .m-btn{background:var(--zolfo);color:var(--inchiostro);border-color:var(--zolfo)}
  .m-btn-zolfo{background:var(--zolfo);color:var(--inchiostro);border-color:var(--zolfo)}
  .m-hero{position:relative;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 6vw;background:var(--carta);overflow:hidden}
  .m-hero-grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(var(--inchiostro) 1px,transparent 1px),linear-gradient(90deg,var(--inchiostro) 1px,transparent 1px);background-size:56px 56px;pointer-events:none}
  .m-hero-sq{position:absolute;pointer-events:none}
  .m-hero-sq.a{width:180px;height:180px;background:var(--cobalto);top:8%;right:8%}
  .m-hero-sq.b{width:70px;height:70px;background:var(--zolfo);bottom:14%;right:22%}
  .m-eyebrow{position:relative;font-family:var(--sans);font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:22px}
  .m-hero h1{position:relative;font-size:clamp(2.6rem,10vw,7.5rem);line-height:.92;font-weight:700;letter-spacing:-.02em;max-width:16ch}
  .m-hero-sub{position:relative;font-family:var(--sans);font-size:.95rem;max-width:46ch;margin:26px 0 30px;line-height:1.6}
  .m-hero-cta{position:relative;display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-family:var(--sans);font-size:.85rem}
  .m-scroll-hint{position:absolute;bottom:26px;left:6vw;font-family:var(--sans);font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;opacity:.5}
  .m-stage{position:relative}
  .m-stage-inner{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center;padding:0 6vw}
  .m-stage-grid{position:absolute;inset:0;opacity:.08;background-image:linear-gradient(currentColor 1px,transparent 1px),linear-gradient(90deg,currentColor 1px,transparent 1px);background-size:56px 56px;pointer-events:none}
  .m-stage-content{position:relative;max-width:760px}
  .m-index{display:block;font-family:var(--sans);font-size:.8rem;letter-spacing:.1em;opacity:.75;margin-bottom:18px}
  .m-h2{font-size:clamp(2.2rem,6.4vw,4.6rem);line-height:.98;font-weight:700;letter-spacing:-.02em;margin-bottom:26px;font-variation-settings:'wdth' calc(125 - var(--p,0)*45)}
  .m-body{font-family:var(--sans);font-size:.98rem;line-height:1.75}
  .m-lead{font-family:'Archivo',serif;font-size:clamp(1.3rem,2.6vw,1.8rem);font-weight:500;line-height:1.5;max-width:34ch}
  .m-word{opacity:.28;transition:opacity .25s ease;display:inline-block}
  .m-word.lit{opacity:1}
  .m-note{font-family:var(--sans);font-size:.9rem;opacity:.85;margin-bottom:20px;max-width:50ch}
  .m-link{text-decoration:underline;text-underline-offset:3px}
  .m-hscroll{overflow:hidden;margin-top:8px}
  .m-hscroll-track{display:flex;gap:16px;will-change:transform}
  .m-stage[data-key="servizi"] .m-stage-content{max-width:none;width:100%}
  .m-hcard{position:relative;flex:0 0 clamp(280px,34vw,480px);min-height:44vh;background:var(--inchiostro);color:var(--carta);padding:26px 26px 30px;font-family:'Archivo',sans-serif;font-weight:700;font-size:clamp(1.4rem,2.6vw,2.2rem);line-height:1.05;display:flex;align-items:flex-end}
  .m-hcard:nth-child(even){background:var(--cobalto)}
  .m-hnum{position:absolute;top:22px;left:26px;font-family:var(--sans);font-size:.8rem;font-weight:500;color:var(--zolfo)}
  .m-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:6px}
  .m-gallery img{aspect-ratio:4/3;object-fit:cover;width:100%}
  .m-stats{display:flex;gap:48px;flex-wrap:wrap}
  .m-bignum{display:block;font-size:clamp(3rem,9vw,6rem);font-weight:800;line-height:.9}
  .m-statlabel{display:block;font-family:var(--sans);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;margin-top:8px;opacity:.8}
  .m-two{display:grid;grid-template-columns:1fr 1fr;gap:26px}
  .m-hours{font-family:var(--sans);font-size:.88rem;border-collapse:collapse}
  .m-hours td{padding:5px 14px 5px 0}
  .m-contactcard p{font-family:var(--sans);margin-bottom:8px}
  .m-contactcard a{text-decoration:underline}
  .m-review{border-left:2px solid currentColor;padding-left:16px;margin-bottom:20px;max-width:56ch}
  .m-review .m-stars{color:var(--zolfo);letter-spacing:2px;margin-bottom:6px}
  .m-review p{font-family:'Archivo',serif;font-style:italic}
  .m-review footer{font-family:var(--sans);font-size:.78rem;opacity:.7;margin-top:8px}
  .m-faqlist{display:grid;gap:18px}
  .m-faqitem h3{font-size:1rem;margin-bottom:6px}
  .m-faqitem p{font-family:var(--sans);font-size:.9rem;opacity:.85}
  .m-dissolve{position:fixed;inset:0;z-index:70;display:grid;grid-template-columns:repeat(10,1fr);grid-template-rows:repeat(6,1fr);pointer-events:none}
  .m-cell{background:var(--dc,var(--cobalto));opacity:var(--o,0)}
  footer.m-footer{font-family:var(--sans);font-size:.8rem;padding:34px 6vw;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;background:var(--inchiostro);color:var(--carta)}
  @media (max-width:760px){.m-header-inner nav{display:none}.m-two{grid-template-columns:1fr}}
  @media (prefers-reduced-motion:reduce){
    .m-stage-inner{position:static;height:auto;padding:70px 6vw}
    .m-stage{height:auto!important}
    .m-h2{font-variation-settings:'wdth' 100}
    .m-word{opacity:1;transition:none}
    .m-hscroll{overflow-x:auto}
    .m-hscroll-track{transform:none!important}
    .m-dissolve,.m-progress{display:none}
  }
</style>
</head>
<body>
${sellBanner}
<div class="m-progress" id="mProgress"></div>
<div class="m-dissolve" id="mDissolve"></div>
<header class="m-header" id="mHeader" data-tone="carta">
  <div class="m-header-inner">
    <span class="m-logo">${name}</span>
    ${navLinks ? `<nav>\n      ${navLinks}\n    </nav>` : ""}
    ${contattaBtn}
  </div>
</header>
<section class="m-hero" id="mHero">
  <div class="m-hero-grid"></div>
  <div class="m-hero-sq a"></div>
  <div class="m-hero-sq b"></div>
  <p class="m-eyebrow">${escapeHtml(label)}${city ? ` · ${city}` : ""}</p>
  <h1 id="mTitle">${name}</h1>
  <p class="m-hero-sub">${escapeHtml(input.copy)}</p>
  <div class="m-hero-cta">
    ${contattaBtn}
    ${address ? `<span>📍 ${address}</span>` : ""}
    ${input.rating ? `<span>★ ${input.rating.toFixed(1)} (${input.reviewCount})</span>` : ""}
  </div>
  <div class="m-scroll-hint">Scorri ↓</div>
</section>
${stagesHtml}
<footer class="m-footer">
  <span><b>${name}</b>${address ? ` · ${address}` : ""}</span>
  <span>Sito demo · nessun cookie, nessun tracciamento</span>
</footer>
${vendBlock}
<script>
(function(){
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.getElementById('mHeader');
  var hero = document.getElementById('mHero');
  var progress = document.getElementById('mProgress');
  var stages = Array.prototype.slice.call(document.querySelectorAll('.m-stage'));
  var dissolveHost = document.getElementById('mDissolve');
  var TONES = { cobalto: '${cobalto}', inchiostro: '${inchiostro}', carta: '${carta}' };
  var CELLS = 60, cells = [];
  for (var i = 0; i < CELLS; i++) {
    var el = document.createElement('div');
    el.className = 'm-cell';
    el.dataset.th = (((i * 37 + 11) % 97) / 97).toFixed(3);
    dissolveHost.appendChild(el);
    cells.push(el);
  }
  if (reduced) return;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var raf = null;
  function onScroll() { if (raf) return; raf = requestAnimationFrame(update); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
  function update() {
    raf = null;
    var y = window.scrollY, vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight - vh;
    progress.style.width = (docH > 0 ? clamp(y / docH, 0, 1) * 100 : 0) + '%';
    var heroH = hero.offsetHeight;
    var hp = clamp(y / heroH, 0, 1);
    document.documentElement.style.setProperty('--wdth', (125 - hp * 57).toFixed(1));
    hero.style.opacity = String(1 - hp * 0.85);
    var activeTone = 'carta', ends = [];
    for (var s = 0; s < stages.length; s++) {
      var st = stages[s], rect = st.getBoundingClientRect();
      var trackH = st.offsetHeight - vh;
      var p = trackH > 0 ? clamp(-rect.top / trackH, 0, 1) : 0;
      var inner = st.querySelector('.m-stage-inner');
      inner.style.setProperty('--p', p.toFixed(3));
      var pinned = rect.top <= 1 && rect.bottom > vh * 0.5;
      if (pinned) activeTone = st.dataset.tone;
      var words = st.querySelectorAll('.m-word');
      if (words.length) {
        var lit = Math.floor(p * words.length * 1.15);
        for (var w = 0; w < words.length; w++) { if (w < lit) words[w].classList.add('lit'); else words[w].classList.remove('lit'); }
      }
      var track = st.querySelector('.m-hscroll-track');
      if (track) {
        var host = track.parentElement;
        var maxX = Math.max(0, track.scrollWidth - host.clientWidth);
        track.style.transform = 'translateX(' + (-p * maxX) + 'px)';
      }
      var top = y + rect.top;
      var next = stages[s + 1];
      if (next) ends.push({ at: top + trackH, color: TONES[next.dataset.tone] || TONES.cobalto });
    }
    header.dataset.tone = activeTone;
    // Si dissolve verso il colore della sezione che arriva, e solo mentre
    // quella corrente se ne va: mai sopra un contenuto appena bloccato.
    var band = vh * 0.45, near = 0, color = TONES.cobalto;
    for (var b = 0; b < ends.length; b++) {
      var d = y - ends[b].at;
      var v = d < 0 ? 1 - clamp(-d / band, 0, 1) : 1 - clamp(d / (band * 0.35), 0, 1);
      if (v > near) { near = v; color = ends[b].color; }
    }
    dissolveHost.style.setProperty('--dc', color);
    for (var c = 0; c < cells.length; c++) {
      var th = parseFloat(cells[c].dataset.th);
      var rise = clamp((near - th) * 6, 0, 1), fall = clamp((near - th - 0.35) * 6, 0, 1);
      cells[c].style.setProperty('--o', String(rise - fall));
    }
  }
})();
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// 2 · CLINICO CALDO — sanitari non medici, veterinari, toelettature
//
// Neutri caldi, un solo accento (salvia o terracotta secondo la categoria),
// angoli morbidi, molto respiro. Animazioni minime e lente — fade brevi,
// una card che si solleva appena, un contatore che si anima una volta sola.
// Niente di spettacolare: qui la calma è il messaggio. Barra fissa in alto
// con telefono e WhatsApp sempre raggiungibili.
// ═══════════════════════════════════════════════════════════════════════

function renderClinico(ctx: SharedCtx): string {
  const { input, name, city, address, label, tel, waBusinessHref, phoneFirst, hoursRows, reviewsUrl, reviewsRows, gallery, hero, sections, menuCompleto } = ctx;

  const accent = input.primaryColor || CATEGORY_PRIMARY[input.category] || "#6E8F5C";
  const accentDeep = deriveShades(accent).deep;
  const carta = "#FBF6EF", carta2 = "#F1E9DA", ink = "#2B241C", inkSoft = "#6B6255";

  const contatta = contattaHref(ctx);

  const heroBg = hero
    ? `background:linear-gradient(180deg,rgba(20,15,8,.15),rgba(20,15,8,.5)),url('${escapeHtml(hero)}') center/cover`
    : `background:linear-gradient(160deg,${accent}22,${carta2})`;

  const chiSiamo = sections.has("chiSiamo") ? `<section id="chi" class="c-sec"><p class="c-eyebrow c-reveal">Chi siamo</p><h2 class="c-reveal">Benvenuti da ${name}</h2><p class="c-intro c-reveal">${escapeHtml(input.copy)}</p></section>` : "";

  const servizi = sections.has("servizi") ? `<section id="servizi" class="c-sec c-alt"><p class="c-eyebrow c-reveal">Servizi</p><h2 class="c-reveal">Cosa potete trovare qui</h2><p class="c-intro c-reveal">Esempi tipici della categoria — da sostituire con i servizi reali di ${name}.</p><div class="c-cards">${CATEGORY_SERVICES[input.category].map((s) => `<div class="c-card c-reveal">${escapeHtml(s)}</div>`).join("")}</div></section>` : "";

  const galleria = sections.has("galleria") && gallery.length ? `<section id="galleria" class="c-sec"><p class="c-eyebrow c-reveal">Galleria</p><h2 class="c-reveal">Uno sguardo allo studio</h2><div class="c-gallery">${gallery.map((src) => `<img class="c-reveal" loading="lazy" src="${escapeHtml(src)}" alt="${name}">`).join("")}</div></section>` : "";

  const numeri = sections.has("numeri") && input.rating ? `<section class="c-sec c-alt"><div class="c-stats"><div class="c-stat c-reveal"><span class="c-count" data-target="${input.rating.toFixed(1)}">0</span><span class="c-statlabel">valutazione media</span></div><div class="c-stat c-reveal"><span class="c-count" data-target="${input.reviewCount}">0</span><span class="c-statlabel">recensioni su Google</span></div></div></section>` : "";

  const doveContatti = sections.has("doveContatti") ? `<section id="dove" class="c-sec"><p class="c-eyebrow c-reveal">Orari e contatti</p><h2 class="c-reveal">Dove e quando trovarci</h2><div class="c-info-grid">${hoursRows ? `<div class="c-card c-reveal"><h3>Orari</h3><table>${hoursRows}</table></div>` : ""}<div class="c-card c-reveal"><h3>Contatti</h3>${address ? `<p><b>${address}</b></p>` : ""}${input.phone ? `<p>Tel: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></p>` : ""}</div></div></section>` : "";

  const mappa = sections.has("mappa") && address ? `<section class="c-sec c-alt"><p class="c-eyebrow c-reveal">Come arrivare</p><h2 class="c-reveal">${address}</h2><a class="c-btn c-reveal" href="https://www.google.com/maps/search/${encodeURIComponent(input.name + " " + (input.address || ""))}" target="_blank" rel="noopener">Apri in Google Maps →</a></section>` : "";

  const recensioni = sections.has("recensioni") && (reviewsRows.length || input.rating) ? `<section id="recensioni" class="c-sec"><p class="c-eyebrow c-reveal">Dicono di noi</p><h2 class="c-reveal">Le recensioni dei pazienti</h2><div class="c-reviews">${reviewsRows.map((r) => `<div class="c-review c-reveal"><div class="c-stars">${r.stars}</div><p>${r.text}</p><footer>${r.author}</footer></div>`).join("")}</div><p class="c-reveal" style="margin-top:20px"><a class="c-link" href="${reviewsUrl}" target="_blank" rel="noopener">Leggi tutte le recensioni su Google →</a></p></section>` : "";

  const faq = sections.has("faq") ? `<section class="c-sec c-alt"><p class="c-eyebrow c-reveal">Domande frequenti</p><h2 class="c-reveal">Le domande più comuni</h2><div class="c-faq">
    <div class="c-faqitem c-reveal"><h3>Serve la prima visita per iniziare?</h3><p>Lo chieda direttamente allo studio: ogni percorso è diverso.</p></div>
    <div class="c-faqitem c-reveal"><h3>Come si prenota?</h3><p>${waBusinessHref || tel ? "Basta chiamare o scrivere su WhatsApp — i recapiti sono sempre in alto." : "Trova i recapiti nella sezione contatti."}</p></div>
    <div class="c-faqitem c-reveal"><h3>Dove siete esattamente?</h3><p>${address ? "L'indirizzo è nella sezione dedicata qui sopra." : "Chieda l'indirizzo scrivendo o chiamando."}</p></div>
  </div></section>` : "";

  const ctaFinale = sections.has("ctaFinale") ? `<section class="c-sec c-cta"><h2>Prenoti quando vuole</h2><p>Un messaggio o una chiamata, e troviamo insieme il momento giusto.</p><div class="c-cta-actions">${waBusinessHref ? `<a class="c-btn c-btn-accent" href="${waBusinessHref}">Scrivici su WhatsApp</a>` : ""}${input.phone ? `<a class="c-link" href="tel:${tel}">oppure chiama: ${escapeHtml(input.phone)}</a>` : ""}</div></section>` : "";

  const mainSections = [chiSiamo, servizi, galleria, numeri, doveContatti, mappa, recensioni, faq, ctaFinale].filter(Boolean).join("\n");

  const navLinks = menuCompleto ? [chiSiamo && '<a href="#chi">Chi siamo</a>', servizi && '<a href="#servizi">Servizi</a>', galleria && '<a href="#galleria">Galleria</a>', doveContatti && '<a href="#dove">Dove siamo</a>', recensioni && '<a href="#recensioni">Recensioni</a>'].filter(Boolean).join("\n      ") : "";

  const { banner: sellBanner, vend: vendBlock } = sellVend(ctx, { bg: ink, fg: carta, btnBg: accent, btnFg: "#fff" });

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${city ? ` — ${city}` : ""} | Demo sito</title>
<meta name="description" content="${name}: ${escapeHtml(input.copy).slice(0, 150)}">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap">
<style>
  :root{--accent:${accent};--accent-deep:${accentDeep};--carta:${carta};--carta2:${carta2};--ink:${ink};--inksoft:${inkSoft};--sans:'Figtree',system-ui,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--sans);background:var(--carta);color:var(--ink);line-height:1.7;font-size:16px}
  a{color:var(--accent)}
  img{max-width:100%;display:block}
  .c-wrap{max-width:920px;margin:0 auto;padding:0 24px}
  .c-book-bar{position:sticky;top:0;z-index:80;background:var(--ink);color:#fff;display:flex;justify-content:center;gap:22px;flex-wrap:wrap;padding:11px 18px;font-size:.86rem}
  .c-book-bar a{color:#fff;text-decoration:none;font-weight:600}
  .c-book-bar a:hover{text-decoration:underline}
  header{background:var(--carta);border-bottom:1px solid var(--carta2);position:sticky;top:38px;z-index:70}
  .c-nav{max-width:920px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px}
  .c-logo{font-size:1.2rem;font-weight:700}
  .c-tag{display:block;font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-top:2px}
  .c-nav nav{display:flex;gap:18px;font-size:.9rem}
  .c-nav nav a{text-decoration:none;color:var(--ink)}
  .c-btn{display:inline-block;font-weight:600;text-decoration:none;padding:13px 24px;border-radius:24px;background:var(--accent);color:#fff;transition:background .2s,transform .2s}
  .c-btn:hover{background:var(--accent-deep);transform:translateY(-2px)}
  .c-btn-accent{background:var(--accent);color:#fff}
  .c-hero{${heroBg};min-height:64vh;display:flex;align-items:flex-end;padding:80px 0 60px;color:${hero ? "#fff" : "var(--ink)"}}
  .c-hero-inner{max-width:920px;margin:0 auto;padding:0 24px;width:100%}
  .c-hero .c-eyebrow{opacity:.9}
  .c-hero h1{font-size:clamp(2.2rem,5.6vw,3.4rem);font-weight:700;line-height:1.08;max-width:16ch;letter-spacing:-.01em;margin:14px 0 18px}
  .c-hero p{max-width:52ch;font-size:1.05rem;margin-bottom:26px;opacity:${hero ? ".95" : "1"}}
  /* Il contenitore dà i margini, i figli restano allineati a sinistra: un
     max-width sul singolo paragrafo non deve più centrarlo. */
  .c-sec{padding:64px max(24px,calc((100% - 920px) / 2))}
  .c-alt{background:var(--carta2)}
  .c-eyebrow{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;font-weight:600}
  h2{font-size:clamp(1.6rem,3.6vw,2.2rem);font-weight:700;margin-bottom:14px;letter-spacing:-.01em}
  .c-intro{color:var(--inksoft);max-width:62ch;font-size:1.02rem}
  .c-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:24px}
  .c-card{background:#fff;border-radius:20px;padding:22px 24px;font-weight:600;box-shadow:0 1px 3px rgba(40,30,10,.06);transition:transform .35s ease}
  .c-card:hover{transform:translateY(-4px)}
  .c-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:26px}
  .c-gallery img{border-radius:20px;height:230px;object-fit:cover;width:100%}
  .c-stats{display:flex;gap:56px;justify-content:center;flex-wrap:wrap;text-align:center;max-width:920px;margin:0 auto;padding:12px 24px}
  .c-count{display:block;font-size:2.8rem;font-weight:700;color:var(--accent)}
  .c-statlabel{display:block;color:var(--inksoft);margin-top:6px;font-size:.9rem}
  .c-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:26px}
  .c-card table{width:100%;border-collapse:collapse;font-size:.92rem}
  .c-card td{padding:5px 0}
  .c-card td:last-child{text-align:right;font-weight:600}
  .c-card h3{font-size:1.02rem;margin-bottom:12px;color:var(--accent)}
  .c-card p{color:var(--inksoft);margin-bottom:6px}
  .c-reviews{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;margin-top:24px}
  .c-review{background:#fff;border-radius:20px;padding:22px}
  .c-review .c-stars{color:var(--accent);margin-bottom:8px}
  .c-review p{font-style:italic}
  .c-review footer{font-size:.82rem;color:var(--inksoft);margin-top:10px}
  .c-faq{display:grid;gap:14px;margin-top:24px}
  .c-faqitem{background:#fff;border-radius:20px;padding:20px 24px}
  .c-faqitem h3{font-size:1rem;color:var(--accent);margin-bottom:6px}
  .c-faqitem p{color:var(--inksoft);font-size:.94rem}
  .c-cta{background:var(--accent);color:#fff;text-align:center;border-radius:28px;max-width:920px;margin:0 auto;padding:56px 30px}
  .c-cta h2{color:#fff}
  .c-cta p{max-width:44ch;margin:0 auto 24px;opacity:.92}
  .c-cta-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;align-items:center}
  .c-cta-actions .c-link{color:#fff;font-weight:600}
  .c-link{text-decoration:underline}
  footer.c-footer{padding:30px 0;font-size:.82rem;color:var(--inksoft)}
  .c-footer-row{max-width:920px;margin:0 auto;padding:20px 24px 0;border-top:1px solid var(--carta2);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
  .c-reveal{opacity:0;transform:translateY(10px);transition:opacity .5s ease,transform .5s ease}
  .c-reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.c-reveal{opacity:1;transform:none;transition:none}}
  @media (max-width:720px){.c-nav nav{display:none}.c-sec{padding:46px 0}}
</style>
</head>
<body>
${sellBanner}
<div class="c-book-bar">
  <span>📅 Prenota una visita</span>
  ${input.phone ? `<a href="tel:${tel}">📞 ${escapeHtml(input.phone)}</a>` : ""}
  ${waBusinessHref ? `<a href="${waBusinessHref}">💬 WhatsApp</a>` : ""}
</div>
<header>
  <div class="c-nav">
    <div><span class="c-logo">${name}</span><span class="c-tag">${escapeHtml(label)}${city ? ` · ${city}` : ""}</span></div>
    ${navLinks ? `<nav>\n      ${navLinks}\n    </nav>` : ""}
    ${contatta ? `<a class="c-btn" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</header>
<section class="c-hero">
  <div class="c-hero-inner">
    <p class="c-eyebrow">${escapeHtml(label)}${city ? ` · ${city}` : ""}</p>
    <h1>${name}</h1>
    <p>${escapeHtml(input.copy)}</p>
    ${contatta ? `<a class="c-btn c-btn-accent" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</section>
${mainSections}
<footer class="c-footer">
  <div class="c-footer-row">
    <span><b>${name}</b>${address ? ` · ${address}` : ""}</span>
    <span>Sito demo · nessun cookie, nessun tracciamento</span>
  </div>
</footer>
${vendBlock}
<script>
  var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.14});
  document.querySelectorAll('.c-reveal').forEach(function(el){io.observe(el);});
  // Contatore: si anima una sola volta quando entra nello schermo.
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cio = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      cio.unobserve(e.target);
      var target = parseFloat(e.target.dataset.target);
      var isDecimal = e.target.dataset.target.indexOf('.') !== -1;
      if (reduced) { e.target.textContent = e.target.dataset.target; return; }
      var start = null, dur = 900;
      function step(ts){
        if(!start) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = target * eased;
        e.target.textContent = isDecimal ? val.toFixed(1) : Math.round(val).toString();
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, {threshold:.5});
  document.querySelectorAll('.c-count').forEach(function(el){cio.observe(el);});
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// 3 · INDUSTRIALE ALTO CONTRASTO — artigiani, palestre, scuole private
//
// Nero pieno, un accento saturo, condensato maiuscolo, tagli diagonali.
// Ticker orizzontale continuo, numeri grandi che si contano da soli,
// immagini in bianco e nero che virano al colore al passaggio del mouse.
// Energia e immediatezza, zero eleganza.
// ═══════════════════════════════════════════════════════════════════════

function renderIndustriale(ctx: SharedCtx): string {
  const { input, name, city, address, label, tel, waBusinessHref, phoneFirst, hoursRows, reviewsUrl, reviewsRows, gallery, hero, sections, menuCompleto } = ctx;

  const accent = input.primaryColor || CATEGORY_PRIMARY.officina || "#E8B400";
  const nero = "#0A0A0A", bianco = "#F2F2F0";
  const contatta = contattaHref(ctx);

  const tickerItems = (sections.has("servizi") ? CATEGORY_SERVICES[input.category] : (input.hours || []).map((h) => `${h.day}: ${h.hours}`));
  const tickerText = tickerItems.length ? tickerItems.join(" — ★ — ") : label;

  const heroBg = hero ? `background:linear-gradient(0deg,rgba(0,0,0,.55),rgba(0,0,0,.25)),url('${escapeHtml(hero)}') center/cover` : `background:${nero}`;

  const chiSiamo = sections.has("chiSiamo") ? `<section id="chi" class="i-sec"><p class="i-eyebrow i-reveal">Chi siamo</p><h2 class="i-reveal">${name}</h2><p class="i-intro i-reveal">${escapeHtml(input.copy)}</p></section>` : "";

  const servizi = sections.has("servizi") ? `<section id="servizi" class="i-sec i-diag"><p class="i-eyebrow i-reveal">Servizi</p><h2 class="i-reveal">Cosa facciamo</h2><div class="i-cards">${CATEGORY_SERVICES[input.category].map((s) => `<div class="i-card i-reveal">${escapeHtml(s)}</div>`).join("")}</div><p class="i-note i-reveal">Esempi tipici della categoria — da sostituire con i servizi reali.</p></section>` : "";

  const galleria = sections.has("galleria") && gallery.length ? `<section id="galleria" class="i-sec"><p class="i-eyebrow i-reveal">Galleria</p><h2 class="i-reveal">Il lavoro fatto</h2><div class="i-gallery">${gallery.map((src) => `<img class="i-reveal" loading="lazy" src="${escapeHtml(src)}" alt="${name}">`).join("")}</div></section>` : "";

  const numeri = sections.has("numeri") && input.rating ? `<section class="i-sec i-diag i-numeri"><div class="i-stats"><div><span class="i-count" data-target="${input.rating.toFixed(1)}">0</span><span class="i-statlabel">valutazione</span></div><div><span class="i-count" data-target="${input.reviewCount}">0</span><span class="i-statlabel">recensioni</span></div></div></section>` : "";

  const doveContatti = sections.has("doveContatti") ? `<section id="dove" class="i-sec"><p class="i-eyebrow i-reveal">Dove e quando</p><h2 class="i-reveal">Orari e contatti</h2><div class="i-two i-reveal">${hoursRows ? `<table class="i-hours">${hoursRows}</table>` : ""}<div>${address ? `<p><b>${address}</b></p>` : ""}${input.phone ? `<p>Tel: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></p>` : ""}</div></div></section>` : "";

  const mappa = sections.has("mappa") && address ? `<section class="i-sec i-diag"><p class="i-eyebrow i-reveal">Come arrivare</p><h2 class="i-reveal">${address}</h2><a class="i-btn i-reveal" href="https://www.google.com/maps/search/${encodeURIComponent(input.name + " " + (input.address || ""))}" target="_blank" rel="noopener">Apri in Google Maps →</a></section>` : "";

  const recensioni = sections.has("recensioni") && (reviewsRows.length || input.rating) ? `<section id="recensioni" class="i-sec"><p class="i-eyebrow i-reveal">Dicono di noi</p><h2 class="i-reveal">Recensioni</h2><div class="i-reviews">${reviewsRows.map((r) => `<div class="i-review i-reveal"><div class="i-stars">${r.stars}</div><p>${r.text}</p><footer>${r.author}</footer></div>`).join("")}</div><p class="i-reveal" style="margin-top:18px"><a class="i-link" href="${reviewsUrl}" target="_blank" rel="noopener">Leggi tutte le recensioni su Google →</a></p></section>` : "";

  const ctaFinale = sections.has("ctaFinale") || sections.has("prenota") ? `<section class="i-sec i-cta"><h2>Chiamaci adesso</h2><p>Rispondiamo subito negli orari di apertura.</p><div class="i-cta-actions">${contatta ? `<a class="i-btn i-btn-big" href="${contatta.href}">${contatta.label}</a>` : ""}</div></section>` : "";

  const mainSections = [chiSiamo, servizi, galleria, numeri, doveContatti, mappa, recensioni, ctaFinale].filter(Boolean).join("\n");
  const navLinks = menuCompleto ? [chiSiamo && '<a href="#chi">Chi siamo</a>', servizi && '<a href="#servizi">Servizi</a>', galleria && '<a href="#galleria">Galleria</a>', doveContatti && '<a href="#dove">Dove</a>', recensioni && '<a href="#recensioni">Recensioni</a>'].filter(Boolean).join("\n      ") : "";

  const { banner: sellBanner, vend: vendBlock } = sellVend(ctx, { bg: "#161616", fg: bianco, btnBg: accent, btnFg: nero });

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${city ? ` — ${city}` : ""} | Demo sito</title>
<meta name="description" content="${name}: ${escapeHtml(input.copy).slice(0, 150)}">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap">
<style>
  :root{--accent:${accent};--nero:${nero};--bianco:${bianco};--display:'Oswald',system-ui,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0;border-radius:0!important}
  body{font-family:system-ui,sans-serif;background:var(--nero);color:var(--bianco);line-height:1.6}
  a{color:var(--accent)}
  img{max-width:100%;display:block}
  h1,h2{font-family:var(--display);text-transform:uppercase;letter-spacing:.01em}
  .i-ticker{background:var(--accent);color:var(--nero);overflow:hidden;white-space:nowrap;padding:9px 0;font-family:var(--display);font-weight:600;font-size:.85rem;text-transform:uppercase;letter-spacing:.04em;border-top:4px solid var(--nero);border-bottom:4px solid var(--nero)}
  .i-ticker-track{display:inline-flex;animation:i-marquee 28s linear infinite}
  .i-ticker-track span{padding-right:3em}
  @keyframes i-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  header{position:sticky;top:0;z-index:60;background:var(--nero);border-bottom:4px solid var(--accent)}
  .i-nav{max-width:1100px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px}
  .i-logo{font-family:var(--display);font-size:1.3rem;text-transform:uppercase}
  .i-tag{display:block;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-top:2px}
  .i-nav nav{display:flex;gap:18px;font-size:.85rem;text-transform:uppercase;font-weight:600}
  .i-nav nav a{text-decoration:none;color:var(--bianco)}
  .i-btn{display:inline-block;font-family:var(--display);font-weight:600;text-transform:uppercase;letter-spacing:.03em;text-decoration:none;padding:13px 24px;background:var(--accent);color:var(--nero);border:3px solid var(--accent)}
  .i-btn:hover{background:transparent;color:var(--accent)}
  .i-btn-big{font-size:1.1rem;padding:18px 36px}
  .i-hero{${heroBg};min-height:76vh;display:flex;align-items:flex-end;padding:70px 24px 60px;position:relative}
  .i-hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;background:var(--accent)}
  .i-hero-inner{max-width:1100px;margin:0 auto;width:100%}
  .i-eyebrow{font-family:var(--display);font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
  .i-hero h1{font-size:clamp(2.6rem,8vw,6rem);line-height:.95;max-width:14ch;margin-bottom:20px}
  .i-hero p{max-width:50ch;font-size:1.05rem;margin-bottom:26px}
  .i-sec{padding:64px 24px;max-width:1100px;margin:0 auto}
  .i-diag{background:#141414;clip-path:polygon(0 22px,100% 0,100% calc(100% - 22px),0 100%);max-width:none;margin:0;padding:84px max(24px,calc((100% - 1100px) / 2 + 24px))}
  h2{font-size:clamp(1.8rem,4.2vw,2.8rem);margin-bottom:16px}
  .i-intro{max-width:62ch;opacity:.85;font-size:1.02rem}
  .i-note{opacity:.6;font-size:.85rem;margin-top:18px}
  .i-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:3px;margin-top:24px}
  .i-card{background:var(--nero);border:3px solid var(--accent);padding:24px 20px;font-family:var(--display);font-weight:600;text-transform:uppercase;font-size:1.05rem}
  .i-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px;margin-top:26px}
  .i-gallery img{height:240px;object-fit:cover;width:100%;filter:grayscale(1) contrast(1.05);transition:filter .4s ease}
  .i-gallery img:hover{filter:grayscale(0) contrast(1.05)}
  .i-numeri{background:var(--accent)!important;color:var(--nero)}
  .i-stats{display:flex;gap:56px;flex-wrap:wrap}
  .i-count{display:block;font-family:var(--display);font-size:clamp(3rem,9vw,5.5rem);font-weight:700;line-height:.9}
  .i-statlabel{display:block;font-weight:600;text-transform:uppercase;font-size:.8rem;letter-spacing:.06em;margin-top:6px}
  .i-two{display:grid;grid-template-columns:1fr 1fr;gap:26px}
  .i-hours{font-size:.9rem;border-collapse:collapse}
  .i-hours td{padding:5px 16px 5px 0}
  .i-reviews{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:3px;margin-top:22px}
  .i-review{background:#141414;border-left:4px solid var(--accent);padding:20px}
  .i-review .i-stars{color:var(--accent);margin-bottom:8px}
  .i-review footer{font-size:.78rem;opacity:.6;margin-top:10px}
  .i-link{text-decoration:underline;font-weight:600}
  .i-cta{text-align:center;background:#141414}
  .i-cta-actions{margin-top:22px}
  footer.i-footer{padding:28px 24px;font-size:.82rem;background:var(--nero);border-top:4px solid var(--accent);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;max-width:1100px;margin:0 auto}
  .i-reveal{opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s ease}
  .i-reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.i-reveal{opacity:1;transform:none;transition:none}.i-ticker-track{animation:none}}
  @media (max-width:760px){.i-nav nav{display:none}.i-two{grid-template-columns:1fr}}
</style>
</head>
<body>
${sellBanner}
<div class="i-ticker"><div class="i-ticker-track"><span>${escapeHtml(tickerText)} — ★ — ${escapeHtml(tickerText)} — ★ —</span><span aria-hidden="true">${escapeHtml(tickerText)} — ★ — ${escapeHtml(tickerText)} — ★ —</span></div></div>
<header>
  <div class="i-nav">
    <div><span class="i-logo">${name}</span><span class="i-tag">${escapeHtml(label)}${city ? ` · ${city}` : ""}</span></div>
    ${navLinks ? `<nav>\n      ${navLinks}\n    </nav>` : ""}
    ${contatta ? `<a class="i-btn" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</header>
<section class="i-hero">
  <div class="i-hero-inner">
    <p class="i-eyebrow">${escapeHtml(label)}${city ? ` · ${city}` : ""}</p>
    <h1>${name}</h1>
    <p>${escapeHtml(input.copy)}</p>
    ${contatta ? `<a class="i-btn i-btn-big" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</section>
${mainSections}
<footer class="i-footer">
  <span><b>${name}</b>${address ? ` · ${address}` : ""}</span>
  <span>Sito demo · nessun cookie, nessun tracciamento</span>
</footer>
${vendBlock}
<script>
  var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.14});
  document.querySelectorAll('.i-reveal').forEach(function(el){io.observe(el);});
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cio = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      cio.unobserve(e.target);
      var target = parseFloat(e.target.dataset.target);
      var isDecimal = e.target.dataset.target.indexOf('.') !== -1;
      if (reduced) { e.target.textContent = e.target.dataset.target; return; }
      var start = null, dur = 900;
      function step(ts){
        if(!start) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = target * eased;
        e.target.textContent = isDecimal ? val.toFixed(1) : Math.round(val).toString();
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, {threshold:.5});
  document.querySelectorAll('.i-count').forEach(function(el){cio.observe(el);});
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// 4 · EDITORIALE FOTOGRAFICO — ristoranti, pizzerie, B&B, agriturismi
//
// La foto è il contenuto: hero a schermo pieno con zoom lentissimo, serif
// display su fondo scuro, testo su griglia larga. Immagine e testo si
// muovono a velocità diverse con lo scroll; la galleria si rivela con
// maschere che si aprono. Serve poco testo e foto buone.
// ═══════════════════════════════════════════════════════════════════════

function renderFotografico(ctx: SharedCtx): string {
  const { input, name, city, address, label, tel, waBusinessHref, phoneFirst, hoursRows, reviewsUrl, reviewsRows, gallery, hero, sections, menuCompleto } = ctx;

  const accent = input.primaryColor || CATEGORY_PRIMARY[input.category] || "#C8862A";
  const fondo = "#15120D", carta = "#EFE9DD";
  const contatta = contattaHref(ctx);

  const heroBg = hero ? `url('${escapeHtml(hero)}') center/cover` : `linear-gradient(160deg,${accent}55,${fondo})`;

  // Foto + testo affiancati, a velocità diverse con lo scroll: alternando il
  // lato della foto sezione per sezione, per un ritmo editoriale.
  function fotoTesto(id: string, idx: number, foto: string, eyebrow: string, titolo: string, corpo: string): string {
    const fotoDestra = idx % 2 === 1;
    return `<section id="${id}" class="f-sec ${fotoDestra ? "f-rev" : ""}">
      <div class="f-photo f-parallax"><img loading="lazy" src="${escapeHtml(foto)}" alt="${name}"></div>
      <div class="f-text f-reveal">
        <p class="f-eyebrow">${eyebrow}</p>
        <h2>${titolo}</h2>
        <div class="f-body">${corpo}</div>
      </div>
    </section>`;
  }

  const usable = gallery.length ? gallery : (hero ? [] : []);
  let fotoIdx = 0;
  const blocks: string[] = [];

  if (sections.has("chiSiamo")) {
    const foto = usable[fotoIdx % usable.length] || hero;
    if (foto) { blocks.push(fotoTesto("f-chiSiamo", fotoIdx++, foto, "Chi siamo", `Benvenuti da ${name}`, `<p>${escapeHtml(input.copy)}</p>`)); }
    else blocks.push(`<section id="f-chiSiamo" class="f-sec f-textonly f-reveal"><p class="f-eyebrow">Chi siamo</p><h2>Benvenuti da ${name}</h2><p class="f-body">${escapeHtml(input.copy)}</p></section>`);
  }

  const serviziLabel = input.category === "ristorante" || input.category === "bar" ? "In carta" : input.category === "hotel" ? "Il soggiorno" : "Servizi";
  if (sections.has("servizi")) {
    const foto = usable[fotoIdx % Math.max(usable.length, 1)] || hero;
    const list = CATEGORY_SERVICES[input.category].map((s) => `<li>${escapeHtml(s)}</li>`).join("");
    const corpo = `<ul class="f-list">${list}</ul><p class="f-note">Esempi tipici della categoria — da sostituire con quelli reali.</p>`;
    if (foto) blocks.push(fotoTesto("f-servizi", fotoIdx++, foto, serviziLabel, "Cosa proponiamo", corpo));
    else blocks.push(`<section id="f-servizi" class="f-sec f-textonly f-reveal"><p class="f-eyebrow">${serviziLabel}</p><h2>Cosa proponiamo</h2>${corpo}</section>`);
  }

  if (sections.has("numeri") && input.rating) {
    blocks.push(`<section class="f-sec f-stats-sec f-reveal"><div class="f-stats"><div><span class="f-bignum">${input.rating.toFixed(1)}</span><span class="f-statlabel">valutazione media</span></div><div><span class="f-bignum">${input.reviewCount}</span><span class="f-statlabel">recensioni su Google</span></div></div></section>`);
  }

  if (sections.has("doveContatti")) {
    blocks.push(`<section id="f-doveContatti" class="f-sec f-textonly f-reveal"><p class="f-eyebrow">Dove e quando</p><h2>Orari e contatti</h2><div class="f-two">${hoursRows ? `<table class="f-hours">${hoursRows}</table>` : ""}<div>${address ? `<p><b>${address}</b></p>` : ""}${input.phone ? `<p>Tel: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></p>` : ""}</div></div></section>`);
  }

  if (sections.has("mappa") && address) {
    blocks.push(`<section class="f-sec f-textonly f-reveal"><p class="f-eyebrow">Come arrivare</p><h2>${address}</h2><a class="f-link" href="https://www.google.com/maps/search/${encodeURIComponent(input.name + " " + (input.address || ""))}" target="_blank" rel="noopener">Apri in Google Maps →</a></section>`);
  }

  if (sections.has("recensioni") && (reviewsRows.length || input.rating)) {
    blocks.push(`<section id="f-recensioni" class="f-sec f-textonly f-reveal"><p class="f-eyebrow">Dicono di noi</p><h2>Le recensioni</h2><div class="f-reviews">${reviewsRows.map((r) => `<div class="f-review"><div class="f-stars">${r.stars}</div><p>${r.text}</p><footer>${r.author}</footer></div>`).join("")}</div><p style="margin-top:18px"><a class="f-link" href="${reviewsUrl}" target="_blank" rel="noopener">Leggi tutte le recensioni su Google →</a></p></section>`);
  }

  const maskGallery = sections.has("galleria") && gallery.length
    ? `<section id="f-galleria" class="f-sec f-textonly f-reveal"><p class="f-eyebrow">Galleria</p><h2>Uno sguardo da ${name}</h2><div class="f-mgrid">${gallery.map((src) => `<div class="f-mask"><img loading="lazy" src="${escapeHtml(src)}" alt="${name}"></div>`).join("")}</div></section>`
    : "";

  const ctaFinale = sections.has("ctaFinale") || sections.has("prenota") ? `<section class="f-sec f-cta"><h2>${input.category === "ristorante" || input.category === "bar" ? "Vieni a trovarci" : "Prenota il tuo soggiorno"}</h2><p>Un messaggio e ti rispondiamo subito.</p>${contatta ? `<a class="f-btn" href="${contatta.href}">${contatta.label}</a>` : ""}</section>` : "";

  const mainSections = [...blocks, maskGallery, ctaFinale].filter(Boolean).join("\n");
  const navLinks = menuCompleto ? ["chiSiamo", "servizi", "galleria", "doveContatti", "recensioni"].filter((k) => sections.has(k)).map((k) => {
    const labels: Record<string, string> = { chiSiamo: "Chi siamo", servizi: serviziLabel, galleria: "Galleria", doveContatti: "Dove siamo", recensioni: "Recensioni" };
    return `<a href="#f-${k}">${labels[k]}</a>`;
  }).join("\n      ") : "";

  const { banner: sellBanner, vend: vendBlock } = sellVend(ctx, { bg: fondo, fg: carta, btnBg: accent, btnFg: "#fff" });

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${city ? ` — ${city}` : ""} | Demo sito</title>
<meta name="description" content="${name}: ${escapeHtml(input.copy).slice(0, 150)}">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500&display=swap">
<style>
  :root{--accent:${accent};--fondo:${fondo};--carta:${carta};--serif:'Fraunces',Georgia,serif;--sans:'Inter',system-ui,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--sans);background:var(--fondo);color:var(--carta);line-height:1.7}
  a{color:var(--accent)}
  img{max-width:100%;display:block}
  h1,h2{font-family:var(--serif);font-weight:600;letter-spacing:-.01em}
  header{position:sticky;top:0;z-index:60;background:rgba(21,18,13,.88);backdrop-filter:blur(6px)}
  .f-nav{max-width:1200px;margin:0 auto;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;gap:14px}
  .f-logo{font-family:var(--serif);font-size:1.3rem}
  .f-tag{display:block;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-top:2px}
  .f-nav nav{display:flex;gap:20px;font-size:.85rem}
  .f-nav nav a{text-decoration:none;color:var(--carta);opacity:.8}
  .f-btn{display:inline-block;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:2px;background:var(--accent);color:#fff}
  .f-hero{position:relative;min-height:100vh;display:flex;align-items:flex-end;overflow:hidden}
  .f-hero-bg{position:absolute;inset:0;background:${heroBg};animation:f-kenburns 24s ease-out forwards}
  @keyframes f-kenburns{from{transform:scale(1)}to{transform:scale(1.14)}}
  .f-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,8,5,.78) 0%,rgba(10,8,5,.45) 55%,rgba(10,8,5,.12) 100%),linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(10,8,5,.88));z-index:1}
  .f-hero-inner{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:0 28px 70px;width:100%}
  .f-eyebrow{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:16px}
  .f-hero h1{font-size:clamp(2.6rem,8vw,6rem);line-height:.98;max-width:16ch;margin-bottom:20px}
  .f-hero p{max-width:52ch;font-size:1.08rem;margin-bottom:26px;opacity:.9}
  .f-sec{max-width:1200px;margin:0 auto;padding:90px 28px;display:grid;grid-template-columns:1.1fr .9fr;gap:60px;align-items:center}
  .f-sec.f-rev{grid-template-columns:.9fr 1.1fr}
  .f-sec.f-rev .f-photo{order:2}
  .f-sec.f-rev .f-text{order:1}
  .f-photo{overflow:hidden}
  .f-photo img{width:100%;height:520px;object-fit:cover;will-change:transform}
  .f-text h2{font-size:clamp(1.9rem,3.6vw,2.8rem);line-height:1.12;margin-bottom:20px}
  .f-textonly h2{line-height:1.12}
  .f-body{font-size:1.02rem;opacity:.92;max-width:44ch}
  .f-list{list-style:none;display:grid;gap:10px;font-family:var(--serif);font-size:1.15rem}
  .f-note{opacity:.55;font-size:.85rem;margin-top:16px}
  .f-textonly{display:block;max-width:760px}
  .f-two{display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:.98rem}
  .f-hours td{padding:4px 14px 4px 0}
  .f-link{text-decoration:underline}
  .f-stats-sec{display:block;text-align:center;max-width:1200px}
  .f-stats{display:flex;gap:64px;justify-content:center;flex-wrap:wrap}
  .f-bignum{display:block;font-family:var(--serif);font-size:clamp(3rem,8vw,5.5rem)}
  .f-statlabel{display:block;font-size:.82rem;opacity:.7;margin-top:8px;text-transform:uppercase;letter-spacing:.06em}
  .f-reviews{display:grid;gap:20px;margin-top:22px}
  .f-review{border-left:2px solid var(--accent);padding-left:18px;max-width:60ch}
  .f-review .f-stars{color:var(--accent);margin-bottom:6px}
  .f-review p{font-family:var(--serif);font-style:italic;font-size:1.08rem}
  .f-review footer{font-size:.8rem;opacity:.65;margin-top:8px}
  .f-mgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:26px}
  .f-mask{overflow:hidden;clip-path:inset(100% 0 0 0);transition:clip-path 1s cubic-bezier(.16,1,.3,1)}
  .f-mask.in{clip-path:inset(0 0 0 0)}
  .f-mask img{height:260px;object-fit:cover;width:100%}
  .f-cta{grid-template-columns:1fr!important;text-align:center;padding-top:60px;padding-bottom:100px}
  .f-cta p{opacity:.85;margin:10px 0 26px}
  footer.f-footer{padding:30px 28px;font-size:.82rem;opacity:.7;max-width:1200px;margin:0 auto;border-top:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
  .f-reveal{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease}
  .f-reveal.in{opacity:1;transform:none}
  @media (max-width:860px){.f-sec{grid-template-columns:1fr!important}.f-sec .f-photo{order:1!important}.f-sec .f-text{order:2!important}.f-nav nav{display:none}}
  @media (prefers-reduced-motion:reduce){.f-hero-bg{animation:none}.f-reveal{opacity:1;transform:none;transition:none}.f-mask{clip-path:inset(0 0 0 0)}.f-parallax img{transform:none!important}}
</style>
</head>
<body>
${sellBanner}
<header>
  <div class="f-nav">
    <div><span class="f-logo">${name}</span><span class="f-tag">${escapeHtml(label)}${city ? ` · ${city}` : ""}</span></div>
    ${navLinks ? `<nav>\n      ${navLinks}\n    </nav>` : ""}
    ${contatta ? `<a class="f-btn" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</header>
<section class="f-hero">
  <div class="f-hero-bg"></div>
  <div class="f-hero-inner">
    <p class="f-eyebrow">${escapeHtml(label)}${city ? ` · ${city}` : ""}</p>
    <h1>${name}</h1>
    <p>${escapeHtml(input.copy)}</p>
    ${contatta ? `<a class="f-btn" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</section>
${mainSections}
<footer class="f-footer">
  <span><b>${name}</b>${address ? ` · ${address}` : ""}</span>
  <span>Sito demo · nessun cookie, nessun tracciamento</span>
</footer>
${vendBlock}
<script>
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.14});
  document.querySelectorAll('.f-reveal,.f-mask').forEach(function(el){io.observe(el);});
  if (!reduced) {
    var raf = null;
    function onScroll(){ if(raf) return; raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', onScroll, {passive:true});
    function update(){
      raf = null;
      document.querySelectorAll('.f-parallax img').forEach(function(img){
        var rect = img.parentElement.getBoundingClientRect();
        var center = rect.top + rect.height/2 - window.innerHeight/2;
        img.style.transform = 'translateY(' + (center * -0.12) + 'px) scale(1.08)';
      });
    }
    update();
  }
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
// 5 · BOUTIQUE MINIMALE — barbieri, estetisti, nail bar
//
// Crema, un solo accento metallico, serif sottile alternato a un sans molto
// piccolo e spaziato, tanto vuoto, linee sottili. Testo che sale una riga
// alla volta, immagini che entrano da dietro una maschera, listino che si
// apre in fisarmonica. Ritmo rallentato.
// ═══════════════════════════════════════════════════════════════════════

function renderBoutique(ctx: SharedCtx): string {
  const { input, name, city, address, label, tel, waBusinessHref, phoneFirst, hoursRows, reviewsUrl, reviewsRows, gallery, hero, sections, menuCompleto } = ctx;

  const metallo = input.primaryColor || CATEGORY_PRIMARY[input.category] || "#B08D57";
  const crema = "#F6F1E8", ink = "#1C1A16", inkSoft = "#7A7266";
  const contatta = contattaHref(ctx);

  function lines(text: string): string {
    const frasi = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return frasi.map((f, i) => `<span class="b-lineclip" style="transition-delay:${i * 110}ms"><span class="b-line">${escapeHtml(f)}</span></span>`).join(" ");
  }

  const heroBg = hero ? `background:linear-gradient(180deg,rgba(20,16,10,.1),rgba(20,16,10,.55)),url('${escapeHtml(hero)}') center/cover` : `background:${crema}`;

  const chiSiamo = sections.has("chiSiamo") ? `<section id="chi" class="b-sec"><p class="b-eyebrow b-reveal">Chi siamo</p><h2 class="b-reveal">${name}</h2><p class="b-intro">${lines(input.copy)}</p></section>` : "";

  const servizi = sections.has("servizi") ? `<section id="servizi" class="b-sec b-alt"><p class="b-eyebrow b-reveal">Listino</p><h2 class="b-reveal">I nostri servizi</h2><div class="b-accordion">${CATEGORY_SERVICES[input.category].map((s) => `<details class="b-reveal"><summary>${escapeHtml(s)}</summary><p>Personalizzi questa voce con la tariffa e i dettagli reali.</p></details>`).join("")}</div></section>` : "";

  const galleria = sections.has("galleria") && gallery.length ? `<section id="galleria" class="b-sec"><p class="b-eyebrow b-reveal">Galleria</p><h2 class="b-reveal">Uno sguardo al salone</h2><div class="b-gallery">${gallery.map((src) => `<div class="b-mask"><img loading="lazy" src="${escapeHtml(src)}" alt="${name}"></div>`).join("")}</div></section>` : "";

  const numeri = sections.has("numeri") && input.rating ? `<section class="b-sec b-alt b-center"><span class="b-bignum b-reveal">${input.rating.toFixed(1)}</span><span class="b-statlabel b-reveal">su Google, ${input.reviewCount} recensioni</span></section>` : "";

  const doveContatti = sections.has("doveContatti") ? `<section id="dove" class="b-sec"><p class="b-eyebrow b-reveal">Dove e quando</p><h2 class="b-reveal">Orari e contatti</h2><div class="b-two b-reveal">${hoursRows ? `<table class="b-hours">${hoursRows}</table>` : ""}<div>${address ? `<p><b>${address}</b></p>` : ""}${input.phone ? `<p>Tel: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></p>` : ""}</div></div></section>` : "";

  const mappa = sections.has("mappa") && address ? `<section class="b-sec b-alt"><p class="b-eyebrow b-reveal">Come arrivare</p><h2 class="b-reveal">${address}</h2><a class="b-link b-reveal" href="https://www.google.com/maps/search/${encodeURIComponent(input.name + " " + (input.address || ""))}" target="_blank" rel="noopener">Apri in Google Maps →</a></section>` : "";

  const recensioni = sections.has("recensioni") && (reviewsRows.length || input.rating) ? `<section id="recensioni" class="b-sec"><p class="b-eyebrow b-reveal">Dicono di noi</p><h2 class="b-reveal">Recensioni</h2><div class="b-reviews">${reviewsRows.map((r) => `<div class="b-review b-reveal"><p>${r.text}</p><footer>${r.author} · ${r.stars}</footer></div>`).join("")}</div><p class="b-reveal" style="margin-top:18px"><a class="b-link" href="${reviewsUrl}" target="_blank" rel="noopener">Leggi tutte le recensioni su Google →</a></p></section>` : "";

  const ctaFinale = sections.has("ctaFinale") || sections.has("prenota") ? `<section class="b-sec b-alt b-center"><h2 class="b-reveal">Un appuntamento?</h2><p class="b-reveal" style="margin:10px 0 24px;color:var(--inksoft)">Scriva o chiami: troviamo insieme il momento giusto.</p>${contatta ? `<a class="b-btn b-reveal" href="${contatta.href}">${contatta.label}</a>` : ""}</section>` : "";

  const mainSections = [chiSiamo, servizi, galleria, numeri, doveContatti, mappa, recensioni, ctaFinale].filter(Boolean).join("\n");
  const navLinks = menuCompleto ? [chiSiamo && '<a href="#chi">Chi siamo</a>', servizi && '<a href="#servizi">Listino</a>', galleria && '<a href="#galleria">Galleria</a>', doveContatti && '<a href="#dove">Dove siamo</a>', recensioni && '<a href="#recensioni">Recensioni</a>'].filter(Boolean).join("\n      ") : "";

  const { banner: sellBanner, vend: vendBlock } = sellVend(ctx, { bg: ink, fg: crema, btnBg: metallo, btnFg: "#fff" });

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${city ? ` — ${city}` : ""} | Demo sito</title>
<meta name="description" content="${name}: ${escapeHtml(input.copy).slice(0, 150)}">
<meta name="robots" content="noindex">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600&family=Inter:wght@400;500&display=swap">
<style>
  :root{--metallo:${metallo};--crema:${crema};--ink:${ink};--inksoft:${inkSoft};--serif:'Cormorant',Georgia,serif;--sans:'Inter',system-ui,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--serif);background:var(--crema);color:var(--ink);line-height:1.75;font-size:18px}
  a{color:var(--metallo)}
  img{max-width:100%;display:block}
  header{position:sticky;top:0;z-index:60;background:var(--crema);border-bottom:1px solid ${metallo}44}
  .b-nav{max-width:1160px;margin:0 auto;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px}
  .b-logo{font-size:1.35rem;letter-spacing:.02em}
  .b-tag{display:block;font-family:var(--sans);font-size:.62rem;letter-spacing:.22em;text-transform:uppercase;color:var(--metallo);margin-top:3px}
  .b-nav nav{display:flex;gap:22px;font-family:var(--sans);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
  .b-nav nav a{text-decoration:none;color:var(--ink);white-space:nowrap}
  .b-btn{white-space:nowrap}
  .b-btn{display:inline-block;font-family:var(--sans);font-size:.76rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;padding:15px 30px;border:1px solid var(--metallo);color:var(--ink);transition:background .4s ease,color .4s ease}
  .b-btn:hover{background:var(--metallo);color:#fff}
  .b-hero{${heroBg};min-height:80vh;display:flex;align-items:center;padding:60px 28px;color:${hero ? "#fff" : "var(--ink)"}}
  .b-hero-inner{max-width:1000px;margin:0 auto;width:100%;text-align:center}
  .b-eyebrow{font-family:var(--sans);font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:var(--metallo);margin-bottom:20px}
  .b-hero h1{font-size:clamp(2.6rem,7vw,4.8rem);font-weight:500;line-height:1.08;letter-spacing:.01em;margin-bottom:22px}
  .b-hero p{max-width:48ch;margin:0 auto 30px;font-size:1.15rem;opacity:.92}
  .b-sec{padding:90px max(28px,calc((100% - 760px) / 2));text-align:left}
  .b-alt{background:#fff}
  .b-center{text-align:center;padding-left:max(28px,calc((100% - 1000px) / 2));padding-right:max(28px,calc((100% - 1000px) / 2))}
  h2{font-size:clamp(1.8rem,3.6vw,2.6rem);font-weight:500;line-height:1.15;margin-bottom:22px}
  .b-intro{max-width:56ch;font-size:1.14rem}
  .b-accordion{display:grid;gap:1px;background:${metallo}33;margin-top:8px}
  .b-accordion details{background:var(--crema);padding:20px 4px}
  .b-accordion summary{font-family:var(--sans);font-size:.95rem;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;list-style:none}
  .b-accordion summary::-webkit-details-marker{display:none}
  .b-accordion summary::after{content:"+";float:right;color:var(--metallo)}
  .b-accordion details[open] summary::after{content:"−"}
  .b-accordion p{font-family:var(--sans);color:var(--inksoft);margin-top:12px;font-size:.9rem}
  .b-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:8px}
  .b-mask{overflow:hidden;clip-path:inset(0 0 100% 0);transition:clip-path 1.1s cubic-bezier(.16,1,.3,1)}
  .b-mask.in{clip-path:inset(0 0 0 0)}
  .b-mask img{height:280px;object-fit:cover;width:100%}
  .b-bignum{display:block;font-size:clamp(3.2rem,9vw,5.5rem);color:var(--metallo)}
  .b-statlabel{display:block;font-family:var(--sans);font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--inksoft);margin-top:10px}
  .b-two{display:grid;grid-template-columns:1fr 1fr;gap:26px;font-family:var(--sans);font-size:.95rem}
  .b-hours td{padding:4px 14px 4px 0}
  .b-link{text-decoration:underline;font-family:var(--sans);font-size:.95rem}
  .b-reviews{display:grid;gap:22px;margin-top:22px}
  .b-review{border-left:1px solid var(--metallo);padding-left:20px;max-width:58ch}
  .b-review p{font-style:italic;font-size:1.1rem}
  .b-review footer{font-family:var(--sans);font-size:.78rem;color:var(--inksoft);margin-top:8px}
  footer.b-footer{padding:30px 28px;font-family:var(--sans);font-size:.8rem;color:var(--inksoft);max-width:1000px;margin:0 auto;border-top:1px solid ${metallo}33;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
  .b-reveal{opacity:0;transform:translateY(14px);transition:opacity .8s ease,transform .8s ease}
  .b-reveal.in{opacity:1;transform:none}
  .b-lineclip{display:inline-block;overflow:hidden;vertical-align:top}
  .b-line{display:inline-block;transform:translateY(100%);transition:transform .9s cubic-bezier(.16,1,.3,1)}
  .b-lineclip.in .b-line{transform:none}
  @media (prefers-reduced-motion:reduce){.b-reveal{opacity:1;transform:none;transition:none}.b-mask{clip-path:inset(0 0 0 0)}.b-line{transform:none;transition:none}}
  @media (max-width:720px){.b-nav nav{display:none}.b-two{grid-template-columns:1fr}}
</style>
</head>
<body>
${sellBanner}
<header>
  <div class="b-nav">
    <div><span class="b-logo">${name}</span><span class="b-tag">${escapeHtml(label)}${city ? ` · ${city}` : ""}</span></div>
    ${navLinks ? `<nav>\n      ${navLinks}\n    </nav>` : ""}
    ${contatta ? `<a class="b-btn" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</header>
<section class="b-hero">
  <div class="b-hero-inner">
    <p class="b-eyebrow">${escapeHtml(label)}${city ? ` · ${city}` : ""}</p>
    <h1>${name}</h1>
    <p>${escapeHtml(input.copy)}</p>
    ${contatta ? `<a class="b-btn" href="${contatta.href}">${contatta.label}</a>` : ""}
  </div>
</section>
${mainSections}
<footer class="b-footer">
  <span><b>${name}</b>${address ? ` · ${address}` : ""}</span>
  <span>Sito demo · nessun cookie, nessun tracciamento</span>
</footer>
${vendBlock}
<script>
  var io = new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.16});
  document.querySelectorAll('.b-reveal,.b-mask,.b-lineclip').forEach(function(el){io.observe(el);});
</script>
</body>
</html>`;
}
