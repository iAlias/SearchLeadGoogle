import { prisma } from "./db";
import { getSettings } from "./settings";

// Tenere per sempre i dati di migliaia di attività che non abbiamo mai
// contattato non serve a niente e non è difendibile: il principio è che un
// dato si conserva finché serve allo scopo per cui è stato raccolto.
//
// Quindi si cancella chi non è mai stato contattato e non lo sarà più.
// Non si cancella mai: chi ha risposto, chi è diventato cliente, e la lista
// delle disiscrizioni — quella deve durare per sempre, perché è l'unica cosa
// che impedisce di ricontattare domani chi ha detto no oggi.

export interface PurgeResult {
  leads: number;
  eventi: number;
  giri: number;
}

export async function purgeOldData(): Promise<PurgeResult> {
  const settings = await getSettings();
  const giorni = Math.max(30, settings.retentionDays || 180);
  const limite = new Date(Date.now() - giorni * 24 * 60 * 60 * 1000);

  const leads = await prisma.lead.deleteMany({
    where: {
      createdAt: { lt: limite },
      emailSentAt: null,
      waSentAt: null,
      repliedAt: null,
      status: { in: ["scraped", "demo_ready", "skipped"] },
      outcome: null,
    },
  });

  // Il registro si tiene il doppio del tempo: è la prova di come ci siamo
  // comportati, e serve dopo, non durante.
  const limiteEventi = new Date(Date.now() - giorni * 2 * 24 * 60 * 60 * 1000);
  const eventi = await prisma.event.deleteMany({ where: { createdAt: { lt: limiteEventi } } });

  const giri = await prisma.outreachRun.deleteMany({
    where: { startedAt: { lt: limiteEventi }, state: { not: "running" } },
  });

  return { leads: leads.count, eventi: eventi.count, giri: giri.count };
}
