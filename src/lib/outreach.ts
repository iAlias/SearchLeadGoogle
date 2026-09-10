import { prisma } from "./db";
import { generateDemoHtml } from "./demoGenerator";
import { generateCopy } from "./ai";
import { sendEmail, buildEmailHtml, hasEmailKey } from "./email";
import { sendWhatsApp, isWaReady } from "./whatsapp";
import { getSettings, fillTemplate } from "./settings";
import { makeSlug, jsonParse, normalizePhoneIt } from "./utils";
import { isSuppressed } from "./suppression";
import type { DemoStyleKey } from "./demoOptions";
import type { Category, Review, OpeningPeriod } from "./types";

type LeadRow = Awaited<ReturnType<typeof prisma.lead.findUniqueOrThrow>>;

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

// Scelte del wizard di generazione demo. Tutti i campi sono opzionali:
// quando mancano, la pagina esce come prima che il wizard esistesse.
export interface WizardDemoOptions {
  style?: DemoStyleKey;
  sections?: string[];
  siteTitle?: string;
  menuMode?: "completo" | "solo-contatti";
  primaryColor?: string;
}

/**
 * Genera (o rigenera) la demo per un lead: testo AI + HTML completo, salva slug+html.
 * Se `options` è passato (il wizard è stato usato) diventa la nuova scelta
 * permanente per quel lead, salvata insieme alla demo; se manca, si riusano
 * le scelte fatte l'ultima volta — o il comportamento di sempre, se non ne
 * sono mai state fatte.
 */
export async function generateDemoForLead(leadId: string, options?: WizardDemoOptions): Promise<{ slug: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead non trovato");
  const settings = await getSettings();

  const photos = jsonParse<string[]>(lead.photos, []);
  const hours = jsonParse<OpeningPeriod[] | null>(lead.hours, null);
  const topReviews = jsonParse<Review[]>(lead.topReviews, []);
  const category = lead.category as Category;
  const effectiveOptions = options ?? jsonParse<WizardDemoOptions>(lead.demoOptions, {});

  const copy = await generateCopy(
    lead.name,
    category,
    lead.city,
    topReviews.map((r) => r.text)
  );

  const slug = lead.demoSlug || makeSlug(lead.name, lead.city || "");
  const html = generateDemoHtml({
    name: lead.name,
    category,
    city: lead.city,
    address: lead.address,
    phone: lead.phone,
    placeId: lead.placeId,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    photos,
    hours,
    topReviews,
    copy,
    sellerName: settings.sellerName || "Chi vi scrive",
    sellerWa: normalizePhoneIt(settings.sellerPhone),
    priceLine: settings.priceLine,
    style: effectiveOptions.style,
    sections: effectiveOptions.sections,
    siteTitle: effectiveOptions.siteTitle,
    menuMode: effectiveOptions.menuMode,
    primaryColor: effectiveOptions.primaryColor,
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      demoSlug: slug,
      demoHtml: html,
      demoOptions: options ? JSON.stringify(options) : lead.demoOptions,
      demoGeneratedAt: new Date(),
      status: lead.status === "scraped" ? "demo_ready" : lead.status,
    },
  });

  return { slug };
}

async function ensureDemo(lead: LeadRow): Promise<string> {
  if (lead.demoSlug && lead.demoHtml) return lead.demoSlug;
  const { slug } = await generateDemoForLead(lead.id);
  return slug;
}

/**
 * Processa la coda outreach:
 *  - lead "approved" senza email inviata → invia email (se ha email)
 *  - lead "email_sent" oltre N giorni senza risposta → invia WhatsApp
 * Rispetta i limiti giornalieri.
 */
export async function runOutreach(): Promise<{
  emailsSent: number;
  waSent: number;
  skipped: number;
  errors: string[];
}> {
  const settings = await getSettings();
  const errors: string[] = [];
  let emailsSent = 0;
  let waSent = 0;
  let skipped = 0;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const sentToday = await prisma.lead.count({ where: { emailSentAt: { gte: since } } });
  const waToday = await prisma.lead.count({ where: { waSentAt: { gte: since } } });

  let emailBudget = Math.max(0, settings.dailyEmailMax - sentToday);
  let waBudget = Math.max(0, settings.dailyWaMax - waToday);

  const sellerWa = normalizePhoneIt(settings.sellerPhone);

  // ── 1. EMAIL per lead approvati ──────────────────────────────
  const toEmail = await prisma.lead.findMany({
    where: { status: "approved", emailSentAt: null, email: { not: null } },
    orderBy: { createdAt: "asc" },
    take: emailBudget,
  });

  for (const lead of toEmail) {
    if (emailBudget <= 0) break;

    // Chi ha chiesto di non essere più contattato non riceve nulla, su
    // nessun canale: il controllo va fatto qui, appena prima di inviare,
    // non solo in fase di importazione della lista.
    if (await isSuppressed(lead.email, "email")) {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "skipped", outcome: "disiscritto" } });
      skipped++;
      continue;
    }

    try {
      const slug = await ensureDemo(lead);
      const demoUrl = `${appUrl()}/demo/${slug}`;
      const unsubscribeUrl = `${appUrl()}/api/unsubscribe?e=${encodeURIComponent(lead.email!)}`;
      const body = fillTemplate(settings.emailBody, {
        nome: lead.name,
        demo: demoUrl,
        prezzo: settings.priceLine,
        venditore: settings.sellerName,
        citta: lead.city || "",
      });
      const subject = fillTemplate(settings.emailSubject, {
        nome: lead.name,
        demo: demoUrl,
        prezzo: settings.priceLine,
        venditore: settings.sellerName,
        citta: lead.city || "",
      });
      const res = await sendEmail({
        to: lead.email!,
        from: settings.emailFrom || process.env.EMAIL_FROM || "onboarding@resend.dev",
        subject,
        html: buildEmailHtml(body, demoUrl, unsubscribeUrl),
        text: body + "\n\n" + demoUrl + "\n\nPer non ricevere più email: " + unsubscribeUrl,
      });
      if (res.ok) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "email_sent", emailSentAt: new Date() },
        });
        emailsSent++;
        emailBudget--;
      } else {
        errors.push(`${lead.name}: email ${res.error}`);
        skipped++;
      }
    } catch (e) {
      errors.push(`${lead.name}: ${(e as Error).message}`);
      skipped++;
    }
  }

  // ── 2. WHATSAPP follow-up ────────────────────────────────────
  if (isWaReady() && waBudget > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.waFollowupDays);

    // a) follow-up di chi ha ricevuto l'email N giorni fa senza rispondere
    // b) lead approvati solo-whatsapp (senza email)
    const toWa = await prisma.lead.findMany({
      where: {
        waSentAt: null,
        repliedAt: null,
        phoneWa: { not: null },
        OR: [
          { status: "email_sent", emailSentAt: { lte: cutoff } },
          { status: "approved", outreachChannel: "whatsapp_only" },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: waBudget,
    });

    for (const lead of toWa) {
      if (waBudget <= 0) break;

      // Stessa regola dell'email: la disiscrizione vale su entrambi i canali,
      // sennò chi si toglie dall'email si ritrova comunque scritto su WhatsApp.
      if (await isSuppressed(lead.phoneWa, "whatsapp") || (await isSuppressed(lead.email, "email"))) {
        await prisma.lead.update({ where: { id: lead.id }, data: { status: "skipped", outcome: "disiscritto" } });
        skipped++;
        continue;
      }

      try {
        const slug = await ensureDemo(lead);
        const demoUrl = `${appUrl()}/demo/${slug}`;
        const msg = fillTemplate(settings.waBody, {
          nome: lead.name,
          demo: demoUrl,
          prezzo: settings.priceLine,
          venditore: settings.sellerName,
          citta: lead.city || "",
        });
        const res = await sendWhatsApp(lead.phoneWa!, msg);
        if (res.ok) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "wa_sent", waSentAt: new Date() },
          });
          waSent++;
          waBudget--;
          // ritardo anti-ban 30-90s tra messaggi
          await new Promise((r) => setTimeout(r, 30000 + Math.floor((Date.now() % 60000))));
        } else {
          errors.push(`${lead.name}: WA ${res.error}`);
          skipped++;
        }
      } catch (e) {
        errors.push(`${lead.name}: ${(e as Error).message}`);
        skipped++;
      }
    }
  }

  void hasEmailKey; // (segnalato altrove in UI)
  void sellerWa;
  return { emailsSent, waSent, skipped, errors };
}
