import { prisma } from "./db";
import { generateDemoHtml } from "./demoGenerator";
import { generateCopy } from "./ai";
import { sendEmail, buildEmailHtml, buildEmailText, unsubscribeHeaders } from "./email";
import { sendWhatsApp, isWaReady } from "./whatsapp";
import { getSettings, fillTemplate, appUrl } from "./settings";
import { makeSlug, jsonParse, normalizePhoneIt } from "./utils";
import { sanitizePhotoList } from "./photos";
import { makeToken } from "./signing";
import { logEvent } from "./events";
import { planOutreach, daRichiamare, SKIP_LABEL, type PlanLead } from "./outreachPlan";
import type { DemoStyleKey } from "./demoOptions";
import type { Category, Review, OpeningPeriod } from "./types";

type LeadRow = Awaited<ReturnType<typeof prisma.lead.findUniqueOrThrow>>;

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

  // Le foto salvate prima che il proxy esistesse contengono la chiave API in
  // chiaro: ripulirle qui evita di riscriverla dentro una demo pubblica.
  const photos = sanitizePhotoList(jsonParse<string[]>(lead.photos, []));
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
      photos: JSON.stringify(photos),
      status: lead.status === "scraped" ? "demo_ready" : lead.status,
    },
  });

  await logEvent("demo_generated", { leadId, detail: effectiveOptions.style || "tema della categoria" });

  return { slug };
}

async function ensureDemo(lead: LeadRow): Promise<string> {
  if (lead.demoSlug && lead.demoHtml) return lead.demoSlug;
  const { slug } = await generateDemoForLead(lead.id);
  return slug;
}

export interface OutreachResult {
  emailsSent: number;
  waSent: number;
  skipped: number;
  /** Pronti ma rimandati a domani dal limite giornaliero: non sono scarti. */
  inCoda: number;
  planned: number;
  daRichiamare: number;
  errors: string[];
  cancelled: boolean;
}


// Quanto aspettare fra un messaggio e l'altro. Le email sono distanziate
// poco (basta non superare il limite di richieste di Resend); i messaggi
// WhatsApp molto, perché è l'unica difesa contro il blocco del numero.
const PAUSA_EMAIL_MS = 4000;
const PAUSA_WA_MIN_MS = 30000;
const PAUSA_WA_MAX_MS = 90000;

function pausaWhatsApp(): number {
  return PAUSA_WA_MIN_MS + Math.floor(Math.random() * (PAUSA_WA_MAX_MS - PAUSA_WA_MIN_MS));
}

const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Esegue un giro di invii. Non è pensata per essere chiamata dentro una
 * richiesta HTTP: fra un messaggio WhatsApp e il successivo passano fino a
 * novanta secondi, quindi un giro completo dura molto più di qualunque
 * timeout. La chiama il job in background (`lib/jobs.ts`), che ne tiene lo
 * stato su OutreachRun perché la pagina possa seguirlo.
 */
export async function runOutreach(runId?: string): Promise<OutreachResult> {
  const settings = await getSettings();
  const errors: string[] = [];
  let emailsSent = 0;
  let waSent = 0;
  let skipped = 0;
  let inCoda = 0;
  let cancelled = false;

  const inizioGiornata = new Date();
  inizioGiornata.setHours(0, 0, 0, 0);

  const [emailsSentToday, waSentToday] = await Promise.all([
    prisma.lead.count({ where: { emailSentAt: { gte: inizioGiornata } } }),
    prisma.lead.count({ where: { waSentAt: { gte: inizioGiornata } } }),
  ]);

  // I candidati, dal più promettente in giù: se il limite giornaliero taglia
  // la coda, ha tagliato i lead peggiori.
  const candidati = await prisma.lead.findMany({
    where: { status: { in: ["approved", "email_sent"] } },
    orderBy: [{ leadScore: "desc" }, { createdAt: "asc" }],
    take: 500,
  });

  const suppressed = new Set(
    (await prisma.suppression.findMany({ select: { contact: true } })).map((s) => s.contact)
  );

  // Contatti già raggiunti da qualunque lead: la stessa attività trovata in
  // due ricerche diverse è due righe qui dentro, ma una persona sola.
  const contacted = new Set<string>();
  const giaContattati = await prisma.lead.findMany({
    where: { OR: [{ emailSentAt: { not: null } }, { waSentAt: { not: null } }] },
    select: { email: true, phoneWa: true, emailSentAt: true, waSentAt: true },
  });
  for (const l of giaContattati) {
    if (l.emailSentAt && l.email) contacted.add(l.email.trim().toLowerCase());
    if (l.waSentAt && l.phoneWa) contacted.add(l.phoneWa);
  }

  const waReady = isWaReady();

  const plan = planOutreach({
    now: new Date(),
    settings: {
      dailyEmailMax: settings.dailyEmailMax,
      dailyWaMax: settings.dailyWaMax,
      waFollowupDays: settings.waFollowupDays,
    },
    emailsSentToday,
    waSentToday,
    leads: candidati.map(toPlanLead),
    suppressed,
    contacted,
    waReady,
  });

  const perId = new Map(candidati.map((l) => [l.id, l]));

  if (runId) {
    await prisma.outreachRun.update({ where: { id: runId }, data: { planned: plan.actions.length } });
  }

  // ── Chi non viene contattato, e perché ───────────────────────────────
  for (const skip of plan.skips) {
    // Il limite giornaliero e il WhatsApp scollegato non sono scarti: quei
    // lead sono ancora in coda e partiranno al prossimo giro. Contarli fra i
    // "saltati" e scriverli nel registro a ogni giro riempirebbe la storia
    // di ogni contatto di righe che non dicono niente.
    if (skip.reason === "limite" || skip.reason === "whatsapp_offline") {
      inCoda++;
      continue;
    }

    skipped++;
    const lead = perId.get(skip.leadId);
    await logEvent("skipped", {
      leadId: skip.leadId,
      channel: skip.channel,
      detail: SKIP_LABEL[skip.reason],
    });
    // Un disiscritto non deve restare in coda a ripresentarsi ogni giro.
    if (skip.reason === "disiscritto" && lead && lead.status !== "skipped") {
      await prisma.lead.update({
        where: { id: skip.leadId },
        data: { status: "skipped", outcome: "disiscritto" },
      });
    }
    if (skip.reason === "duplicato" && lead && lead.status === "approved") {
      await prisma.lead.update({
        where: { id: skip.leadId },
        data: { status: "skipped", outcome: "duplicato" },
      });
    }
  }

  // ── Gli invii veri ───────────────────────────────────────────────────
  for (const [i, action] of plan.actions.entries()) {
    if (runId && (await cancellazioneRichiesta(runId))) {
      cancelled = true;
      break;
    }

    const lead = perId.get(action.leadId);
    if (!lead) continue;

    if (runId) {
      await prisma.outreachRun.update({
        where: { id: runId },
        data: { currentLead: lead.name, heartbeatAt: new Date() },
      });
    }

    try {
      const slug = await ensureDemo(lead);
      const demoUrl = `${appUrl()}/demo/${slug}`;
      const vars = {
        nome: lead.name,
        demo: demoUrl,
        prezzo: settings.priceLine,
        venditore: settings.sellerName,
        citta: lead.city || "",
      };

      if (action.channel === "email") {
        const token = await makeToken(settings.secret, { e: action.to, l: lead.id });
        const unsubscribeUrl = `${appUrl()}/api/unsubscribe?t=${token}`;
        const privacyUrl = `${appUrl()}/privacy`;
        const body = fillTemplate(settings.emailBody, vars);
        const subject = fillTemplate(settings.emailSubject, vars);

        const res = await sendEmail({
          to: action.to,
          from: settings.emailFrom || process.env.EMAIL_FROM || "onboarding@resend.dev",
          subject,
          html: buildEmailHtml(body, demoUrl, { unsubscribeUrl, privacyUrl }),
          text: buildEmailText(body, demoUrl, { unsubscribeUrl, privacyUrl }),
          headers: unsubscribeHeaders(unsubscribeUrl),
        });

        if (res.ok) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "email_sent", emailSentAt: new Date(), emailId: res.id ?? null },
          });
          await logEvent("email_sent", {
            leadId: lead.id,
            channel: "email",
            detail: res.dryRun ? "prova a vuoto: nessuna chiave Resend configurata" : action.to,
          });
          emailsSent++;
          if (runId) await incrementa(runId, { emailsSent: 1 });
        } else {
          errors.push(`${lead.name}: email ${res.error}`);
          skipped++;
          await logEvent("error", { leadId: lead.id, channel: "email", detail: res.error });
          if (runId) await incrementa(runId, { skipped: 1 }, errors);
        }

        if (i < plan.actions.length - 1) await attendi(PAUSA_EMAIL_MS);
      } else {
        const msg = fillTemplate(settings.waBody, vars);
        const res = await sendWhatsApp(action.to, msg);

        if (res.ok) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "wa_sent", waSentAt: new Date() },
          });
          await logEvent("wa_sent", { leadId: lead.id, channel: "whatsapp", detail: action.to });
          waSent++;
          if (runId) await incrementa(runId, { waSent: 1 });
        } else {
          errors.push(`${lead.name}: WhatsApp ${res.error}`);
          skipped++;
          await logEvent("error", { leadId: lead.id, channel: "whatsapp", detail: res.error });
          if (runId) await incrementa(runId, { skipped: 1 }, errors);
        }

        // La pausa lunga vale solo fra due messaggi veri: è quella che tiene
        // il numero fuori dai radar antispam di WhatsApp.
        if (i < plan.actions.length - 1) await attendi(pausaWhatsApp());
      }
    } catch (e) {
      const msg = (e as Error).message;
      errors.push(`${lead.name}: ${msg}`);
      skipped++;
      await logEvent("error", { leadId: lead.id, detail: msg });
      if (runId) await incrementa(runId, { skipped: 1 }, errors);
    }
  }

  // ── Terzo passo: chi ha ricevuto tutto e non ha mai risposto ─────────
  const scaduti = await prisma.lead.findMany({
    where: { status: "wa_sent", repliedAt: null, waSentAt: { not: null } },
    select: { id: true, waSentAt: true, repliedAt: true, status: true },
  });
  const daChiamare = scaduti.filter((l) => daRichiamare(l, new Date(), settings.waFollowupDays));
  if (daChiamare.length) {
    await prisma.lead.updateMany({
      where: { id: { in: daChiamare.map((l) => l.id) } },
      data: { status: "da_richiamare" },
    });
    for (const l of daChiamare) {
      await logEvent("skipped", {
        leadId: l.id,
        detail: "email e WhatsApp inviati senza risposta: da richiamare o da lasciar perdere",
      });
    }
  }

  return {
    emailsSent,
    waSent,
    skipped,
    inCoda,
    planned: plan.actions.length,
    daRichiamare: daChiamare.length,
    errors,
    cancelled,
  };
}

function toPlanLead(l: LeadRow): PlanLead {
  return {
    id: l.id,
    name: l.name,
    email: l.email,
    phoneWa: l.phoneWa,
    status: l.status,
    outreachChannel: l.outreachChannel,
    emailSentAt: l.emailSentAt,
    waSentAt: l.waSentAt,
    repliedAt: l.repliedAt,
  };
}

async function cancellazioneRichiesta(runId: string): Promise<boolean> {
  const run = await prisma.outreachRun.findUnique({ where: { id: runId }, select: { cancelRequested: true } });
  return !!run?.cancelRequested;
}

async function incrementa(
  runId: string,
  delta: { emailsSent?: number; waSent?: number; skipped?: number },
  errors?: string[]
): Promise<void> {
  await prisma.outreachRun.update({
    where: { id: runId },
    data: {
      emailsSent: delta.emailsSent ? { increment: delta.emailsSent } : undefined,
      waSent: delta.waSent ? { increment: delta.waSent } : undefined,
      skipped: delta.skipped ? { increment: delta.skipped } : undefined,
      heartbeatAt: new Date(),
      errors: errors ? JSON.stringify(errors.slice(-20)) : undefined,
    },
  });
}
