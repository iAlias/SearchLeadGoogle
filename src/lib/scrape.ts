import { prisma } from "./db";
import { searchPlaces, hasPlacesKey } from "./places";
import { scrapeMaps } from "./mapsScraper";
import { scrapeEmail } from "./emailScraper";
import { checkWebsiteDetailed } from "./websiteCheck";
import { detectCategory } from "./category";
import { normalizePhoneIt } from "./utils";
import { sanitizePhotoList } from "./photos";
import { scoreLead } from "./leadScore";
import type { RawLead } from "./types";

const STALLO_MS = 3 * 60 * 1000;

// Concorrenza limitata per l'arricchimento (controllo sito + email).
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
  onDone?: (fatti: number) => void
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  let fatti = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      fatti++;
      onDone?.(fatti);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Esegue una campagna: cerca le attività, ne verifica il sito, trova le
 * email, calcola quanto vale ciascun contatto e salva tutto.
 *
 * Tiene aggiornato un battito: una campagna che risulta "in corso" ma non dà
 * segni di vita da qualche minuto è un processo morto con il riavvio del
 * server, non un lavoro lento — e va segnata come tale invece di restare
 * "in corso" per sempre.
 */
export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campagna non trovata");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "running",
      error: null,
      startedAt: new Date(),
      heartbeatAt: new Date(),
      finishedAt: null,
      foundCount: 0,
      processedCount: 0,
      cancelRequested: false,
    },
  });

  const battito = setInterval(() => {
    prisma.campaign.update({ where: { id: campaignId }, data: { heartbeatAt: new Date() } }).catch(() => {});
  }, 15000);

  try {
    // 1. Scelta motore.
    const engine =
      campaign.engine === "places" || (campaign.engine === "auto" && hasPlacesKey()) ? "places" : "scrape";

    let raw: RawLead[];
    if (engine === "places") {
      raw = await searchPlaces(campaign.businessType, campaign.location, campaign.targetCount);
    } else {
      raw = await scrapeMaps(campaign.businessType, campaign.location, campaign.targetCount);
    }

    // 2. Dedup per nome+indirizzo.
    const seen = new Set<string>();
    raw = raw.filter((r) => {
      const k = (r.name + "|" + (r.address || "")).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { foundCount: raw.length, heartbeatAt: new Date() },
    });

    if (await annullamentoRichiesto(campaignId)) {
      await chiudi(campaignId, "cancelled", "Ricerca annullata.");
      return;
    }

    // 3. Arricchimento: stato sito + email (in parallelo, max 5 alla volta).
    const enriched = await mapLimit(
      raw,
      5,
      async (r) => {
        const giudizio = await checkWebsiteDetailed(r.website);
        let email: string | null = null;
        let emailSource = "none";
        // Cerca l'email solo se ha un sito: è da lì che la si ricava.
        if (r.website && giudizio.status !== "none") {
          const found = await scrapeEmail(r.website);
          email = found.email;
          emailSource = found.source;
        }
        return { r, giudizio, email, emailSource };
      },
      (fatti) => {
        if (fatti % 5 === 0 || fatti === raw.length) {
          prisma.campaign
            .update({ where: { id: campaignId }, data: { processedCount: fatti, heartbeatAt: new Date() } })
            .catch(() => {});
        }
      }
    );

    // 4. Salvataggio. Un lead vale se ha il sito assente o scadente (e quindi
    //    è vendibile). Quelli con un sito buono li teniamo comunque, marcati:
    //    li si filtra dalla dashboard.
    for (const { r, giudizio, email, emailSource } of enriched) {
      const phoneWa = normalizePhoneIt(r.phone);
      const channel =
        email && phoneWa ? "email_and_wa" : email ? "email_only" : phoneWa ? "whatsapp_only" : "none";

      // Le foto non devono mai portare con sé la chiave API: finirebbero
      // così com'è nell'HTML di una demo pubblica.
      const photos = sanitizePhotoList(r.photos || []);

      const { score } = scoreLead({
        websiteStatus: giudizio.status,
        reviewCount: r.reviewCount,
        rating: r.rating,
        hasEmail: !!email,
        hasPhone: !!phoneWa,
        photoCount: photos.length,
      });

      const placeKey = r.placeId || `noid-${campaignId}-${r.name}-${r.address || ""}`;

      await prisma.lead.upsert({
        where: { placeId: placeKey },
        create: {
          campaignId,
          placeId: placeKey,
          name: r.name,
          category: detectCategory(campaign.businessType + " " + r.name),
          address: r.address,
          city: r.city || campaign.location,
          phone: r.phone,
          phoneWa,
          email,
          emailSource,
          website: r.website,
          websiteStatus: giudizio.status,
          websiteReasons: JSON.stringify(giudizio.reasons),
          rating: r.rating,
          reviewCount: r.reviewCount || 0,
          photos: JSON.stringify(photos),
          hours: r.hours ? JSON.stringify(r.hours) : null,
          topReviews: JSON.stringify(r.topReviews || []),
          lat: r.lat,
          lng: r.lng,
          leadScore: score,
          outreachChannel: channel,
          status: "scraped",
        },
        update: {
          // refresh dei dati su re-scan
          phone: r.phone,
          phoneWa,
          email: email ?? undefined,
          emailSource,
          website: r.website,
          websiteStatus: giudizio.status,
          websiteReasons: JSON.stringify(giudizio.reasons),
          rating: r.rating,
          reviewCount: r.reviewCount || 0,
          photos: JSON.stringify(photos),
          hours: r.hours ? JSON.stringify(r.hours) : null,
          topReviews: JSON.stringify(r.topReviews || []),
          leadScore: score,
        },
      });
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "done",
        engine,
        processedCount: enriched.length,
        finishedAt: new Date(),
        heartbeatAt: new Date(),
      },
    });
  } catch (e) {
    await chiudi(campaignId, "failed", (e as Error).message);
    throw e;
  } finally {
    clearInterval(battito);
  }
}

async function annullamentoRichiesto(campaignId: string): Promise<boolean> {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { cancelRequested: true } });
  return !!c?.cancelRequested;
}

async function chiudi(campaignId: string, status: string, error: string | null): Promise<void> {
  await prisma.campaign
    .update({ where: { id: campaignId }, data: { status, error, finishedAt: new Date() } })
    .catch(() => {});
}

/**
 * Campagne rimaste "in corso" dopo un riavvio: senza questo restano così per
 * sempre, e la pagina mostra uno spinner che non finirà mai.
 */
export async function recoverStaleCampaigns(): Promise<number> {
  const limite = new Date(Date.now() - STALLO_MS);
  const res = await prisma.campaign.updateMany({
    where: {
      status: "running",
      OR: [{ heartbeatAt: { lt: limite } }, { heartbeatAt: null, updatedAt: { lt: limite } }],
    },
    data: {
      status: "failed",
      error: "Interrotta: il server si è fermato durante la ricerca. Puoi rilanciarla.",
      finishedAt: new Date(),
    },
  });
  return res.count;
}
