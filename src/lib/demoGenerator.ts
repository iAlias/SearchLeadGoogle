import type { Category, Review, OpeningPeriod } from "./types";
import { CATEGORY_LABEL } from "./category";
import { escapeHtml, normalizePhoneIt } from "./utils";

// Genera un sito demo completo (HTML standalone, CSS inline, mobile-first)
// popolato con i dati REALI dell'attivita. Stile derivato dai template "Sito in 48 ore".

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

export interface DemoInput {
  name: string;
  category: Category;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
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
}

function stars(n: number): string {
  const full = Math.round(n);
  return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
}

export function generateDemoHtml(input: DemoInput): string {
  const p = PALETTES[input.category] || PALETTES.generico;
  const name = escapeHtml(input.name);
  const city = escapeHtml(input.city || "");
  const address = escapeHtml(input.address || "");
  const label = CATEGORY_LABEL[input.category];
  const wa = normalizePhoneIt(input.phone);
  const tel = input.phone ? input.phone.replace(/[^\d+]/g, "") : "";
  const sellerWa = input.sellerWa;

  const hero = input.photos[0] || "";
  const gallery = input.photos.slice(1, 4);

  const waBusinessHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Buongiorno ${input.name}, vorrei informazioni`)}`
    : "";

  // Per un veterinario, in un'emergenza si chiama, non si scrive. Diamo
  // priorita' alla telefonata solo se il numero c'e' davvero: nessuna
  // promessa di reperibilita' che non conosciamo, solo il dato reale messo
  // nel punto giusto.
  const phoneFirst = input.category === "veterinario" && !!tel;

  const sellerHref = sellerWa
    ? `https://wa.me/${sellerWa}?text=${encodeURIComponent(`Ciao! Ho visto la demo del sito per ${input.name}, mi interessa`)}`
    : "#contatti-venditore";

  const hoursRows = (input.hours || [])
    .map(
      (h) =>
        `<tr><td>${escapeHtml(h.day)}</td><td>${escapeHtml(h.hours) || "—"}</td></tr>`
    )
    .join("");

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

  const galleryHtml = gallery.length
    ? `<section class="alt"><div class="wrap">
        <p class="kicker reveal">Galleria</p>
        <h2 class="reveal">Uno sguardo da ${name}</h2>
        <div class="gallery">${gallery
          .map((src) => `<img loading="lazy" src="${escapeHtml(src)}" alt="${name}">`)
          .join("")}</div>
      </div></section>`
    : "";

  const heroStyle = hero
    ? `background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.62)),url('${escapeHtml(hero)}') center/cover`
    : `background:linear-gradient(160deg,${p.primary} 0%,${p.deep} 70%)`;

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
  .btn{display:inline-block;font-family:var(--sans);font-weight:600;text-decoration:none;padding:12px 22px;border-radius:7px;background:var(--primary);color:#fff;border:1px solid var(--primary);transition:.15s}
  .btn:hover{background:var(--deep)}
  .btn-accent{background:var(--accent);border-color:var(--accent);color:var(--ink)}
  /* hero */
  .hero{${heroStyle};color:#fff;padding:110px 0 96px;text-align:left}
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
  /* gallery */
  .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:28px}
  .gallery img{border-radius:12px;height:240px;object-fit:cover;width:100%}
  /* info */
  .info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px;margin-top:30px}
  .card{background:#fff;border:1px solid var(--bg2);border-radius:12px;padding:26px}
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
  .review{background:#fff;border:1px solid var(--bg2);border-radius:12px;padding:24px}
  .review .stars{color:var(--accent);letter-spacing:3px;margin-bottom:10px}
  .review p{font-style:italic;font-size:1rem;line-height:1.55}
  .review footer{font-family:var(--sans);font-size:.82rem;color:#7a756e;margin-top:12px}
  /* cta */
  .cta{background:var(--primary);color:#fff;text-align:center;border-radius:16px;padding:54px 28px;margin:0 22px}
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
  .reveal{opacity:0;transform:translateY(14px);transition:opacity .6s cubic-bezier(.16,1,.3,1),transform .6s cubic-bezier(.16,1,.3,1)}
  .reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
  @media (max-width:760px){.nav nav{display:none}section{padding:50px 0}.hero{padding:80px 0 64px}}
</style>
</head>
<body>

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
    <nav>
      <a href="#chi">Chi siamo</a>
      ${gallery.length ? '<a href="#galleria">Galleria</a>' : ""}
      <a href="#dove">Dove siamo</a>
      ${reviewsHtml ? '<a href="#recensioni">Recensioni</a>' : ""}
    </nav>
    ${
      phoneFirst
        ? `<a class="btn" href="tel:${tel}">Chiama ora</a>`
        : waBusinessHref
          ? `<a class="btn" href="${waBusinessHref}">Contattaci</a>`
          : tel
            ? `<a class="btn" href="tel:${tel}">Chiama</a>`
            : ""
    }
  </div>
</header>

<main>
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">${escapeHtml(label)}${city ? ` · ${city}` : ""}</p>
      <h1>${name}</h1>
      <p>${escapeHtml(input.copy)}</p>
      ${
        phoneFirst
          ? `<a class="btn btn-accent" href="tel:${tel}">Chiamaci ora</a>`
          : waBusinessHref
            ? `<a class="btn btn-accent" href="${waBusinessHref}">Scrivici su WhatsApp</a>`
            : tel
              ? `<a class="btn btn-accent" href="tel:${tel}">Chiamaci ora</a>`
              : ""
      }
      <div class="hero-meta">
        ${address ? `<span>📍 ${address}</span>` : ""}
        ${input.phone ? `<span>📞 ${escapeHtml(input.phone)}</span>` : ""}
        ${input.rating ? `<span>⭐ ${input.rating.toFixed(1)} (${input.reviewCount} recensioni)</span>` : ""}
      </div>
    </div>
  </section>

  <section id="chi" class="wrap">
    <p class="kicker reveal">Chi siamo</p>
    <h2 class="reveal">Benvenuti da ${name}</h2>
    <p class="intro reveal">${escapeHtml(input.copy)}</p>
  </section>

  ${galleryHtml ? galleryHtml.replace('<section class="alt">', '<section id="galleria" class="alt">') : ""}

  <section id="dove" class="wrap">
    <p class="kicker reveal">Orari e contatti</p>
    <h2 class="reveal">Dove e quando trovarci</h2>
    <div class="info-grid">
      ${
        hoursRows
          ? `<div class="card reveal"><h3>Orari di apertura</h3><table>${hoursRows}</table></div>`
          : ""
      }
      <div class="card reveal">
        <h3>Contatti</h3>
        ${address ? `<p style="margin-bottom:8px"><b>${address}</b></p>` : ""}
        ${input.phone ? `<p>Tel: <a href="tel:${tel}"><b>${escapeHtml(input.phone)}</b></a></p>` : ""}
        ${
          address
            ? `<p style="margin-top:12px"><a href="https://www.google.com/maps/search/${encodeURIComponent(
                input.name + " " + (input.address || "")
              )}" target="_blank" rel="noopener">Apri in Google Maps →</a></p>`
            : ""
        }
      </div>
      ${
        input.rating
          ? `<div class="card reveal"><h3>Su Google</h3><div class="ratingbig"><div class="num">${input.rating.toFixed(
              1
            )}</div><div class="st">${stars(input.rating)}</div><p style="margin-top:8px">${
              input.reviewCount
            } recensioni</p></div></div>`
          : ""
      }
    </div>
  </section>

  ${
    reviewsHtml
      ? `<section id="recensioni" class="alt"><div class="wrap">
          <p class="kicker reveal">Dicono di noi</p>
          <h2 class="reveal">Le recensioni dei clienti</h2>
          <div class="reviews">${reviewsHtml}</div>
        </div></section>`
      : ""
  }

  <section class="wrap">
    <div class="cta reveal">
      <h2>${
        input.category === "ristorante" || input.category === "bar"
          ? "Vieni a trovarci"
          : "Mettiti in contatto"
      }</h2>
      <p>Un messaggio e ti rispondiamo subito negli orari di apertura.</p>
      ${
        waBusinessHref
          ? `<a class="btn btn-accent" href="${waBusinessHref}">Scrivici su WhatsApp</a>`
          : ""
      }
      ${input.phone ? `<span class="tel">oppure chiama: <a href="tel:${tel}">${escapeHtml(input.phone)}</a></span>` : ""}
    </div>
  </section>
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
</script>
</body>
</html>`;
}
