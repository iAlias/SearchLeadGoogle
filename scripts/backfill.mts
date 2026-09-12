// Aggiorna le righe scritte prima di questa versione. Da lanciare una volta
// sola, con `npm run db:backfill`, dopo `npm run db:push`.
//
// Fa tre cose, tutte su dati che esistono già:
//   1. toglie la chiave Google dalle foto salvate e dalle demo già generate
//      (finora finiva in chiaro dentro ogni pagina pubblica);
//   2. calcola il punteggio dei lead, che prima non esisteva e senza il
//      quale la lista risulterebbe tutta a zero;
//   3. riempie i motivi del giudizio sul sito, dove si può dedurli.

import { prisma } from "../src/lib/db";
import { sanitizePhotoList, sanitizePhotoUrl } from "../src/lib/photos";
import { scoreLead } from "../src/lib/leadScore";
import { jsonParse } from "../src/lib/utils";

const MEDIA_RE = /https:\/\/places\.googleapis\.com\/v1\/places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+\/media\?[^"'\s)<>]*/g;

const MOTIVO_PREDEFINITO: Record<string, string[]> = {
  none: ["non risulta nessun sito"],
  bad: ["il sito è assente, rotto o troppo povero (giudizio precedente a questa versione)"],
  good: [],
};

let fotoRipulite = 0;
let demoRipulite = 0;
let punteggi = 0;
let motivi = 0;

const leads = await prisma.lead.findMany();
console.log(`Lead da controllare: ${leads.length}`);

for (const lead of leads) {
  const dati: Record<string, unknown> = {};

  // 1a. Foto salvate.
  const fotoPrima = jsonParse<string[]>(lead.photos, []);
  const fotoDopo = sanitizePhotoList(fotoPrima);
  if (JSON.stringify(fotoPrima) !== JSON.stringify(fotoDopo)) {
    dati.photos = JSON.stringify(fotoDopo);
    fotoRipulite++;
  }

  // 1b. Demo già generate: la chiave è dentro l'HTML pubblicato.
  if (lead.demoHtml && (lead.demoHtml.includes("places.googleapis.com") || lead.demoHtml.includes("key="))) {
    let html = lead.demoHtml.replace(MEDIA_RE, (url) => sanitizePhotoUrl(url) || "");
    // Rete di sicurezza: qualunque altro parametro `key` rimasto in giro.
    html = html.replace(/([?&])key=[^&"'\s<>]*/g, "$1");
    if (html !== lead.demoHtml) {
      dati.demoHtml = html;
      demoRipulite++;
    }
  }

  // 2. Punteggio.
  if (lead.leadScore === 0) {
    const { score } = scoreLead({
      websiteStatus: lead.websiteStatus,
      reviewCount: lead.reviewCount,
      rating: lead.rating,
      hasEmail: !!lead.email,
      hasPhone: !!lead.phoneWa,
      photoCount: fotoDopo.length,
    });
    dati.leadScore = score;
    punteggi++;
  }

  // 3. Motivi del giudizio sul sito.
  if (!lead.websiteReasons || lead.websiteReasons === "[]") {
    const predefiniti = MOTIVO_PREDEFINITO[lead.websiteStatus];
    if (predefiniti?.length) {
      dati.websiteReasons = JSON.stringify(predefiniti);
      motivi++;
    }
  }

  if (Object.keys(dati).length) {
    await prisma.lead.update({ where: { id: lead.id }, data: dati });
  }
}

console.log(`Foto ripulite dalla chiave: ${fotoRipulite}`);
console.log(`Demo già generate ripulite: ${demoRipulite}`);
console.log(`Punteggi calcolati: ${punteggi}`);
console.log(`Motivi compilati: ${motivi}`);

const residui = await prisma.lead.count({ where: { demoHtml: { contains: "key=AIza" } } });
console.log(residui === 0 ? "Nessuna chiave residua nelle demo." : `ATTENZIONE: ${residui} demo contengono ancora una chiave.`);

await prisma.$disconnect();
