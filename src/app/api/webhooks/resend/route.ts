import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { addSuppression } from "@/lib/suppression";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quello che l'email fa dopo essere partita. Senza questi eventi il sistema
// sa solo "inviata": continua a scrivere a indirizzi che non esistono più e
// non si accorge di chi l'ha segnalata come spam — che è il modo più veloce
// per bruciare la reputazione del dominio e finire nella cartella sbagliata
// per tutti gli invii successivi.
//
// Da configurare su resend.com/webhooks puntando a <APP_URL>/api/webhooks/resend,
// con il segreto in RESEND_WEBHOOK_SECRET.

interface ResendEvent {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

const TOLLERANZA_S = 5 * 60;

/** Firma Svix, quella usata da Resend: HMAC-SHA256 su "id.timestamp.corpo". */
function verificaFirma(secret: string, id: string, timestamp: string, body: string, header: string): boolean {
  const chiave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const atteso = createHmac("sha256", chiave).update(`${id}.${timestamp}.${body}`).digest("base64");

  // L'intestazione può contenere più firme (rotazione del segreto):
  // "v1,firmaA v1,firmaB". Ne basta una valida.
  for (const parte of header.split(" ")) {
    const firma = parte.includes(",") ? parte.split(",")[1] : parte;
    if (!firma) continue;
    const a = Buffer.from(firma, "base64");
    const b = Buffer.from(atteso, "base64");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook non configurato: manca RESEND_WEBHOOK_SECRET" }, { status: 503 });
  }

  const body = await req.text();
  const id = req.headers.get("svix-id") || "";
  const timestamp = req.headers.get("svix-timestamp") || "";
  const signature = req.headers.get("svix-signature") || "";

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Firma mancante" }, { status: 400 });
  }
  // Un messaggio vecchio ricopiato pari pari non deve poter essere rigiocato.
  const eta = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(eta) || eta > TOLLERANZA_S) {
    return NextResponse.json({ error: "Richiesta scaduta" }, { status: 400 });
  }
  if (!verificaFirma(secret, id, timestamp, body, signature)) {
    return NextResponse.json({ error: "Firma non valida" }, { status: 401 });
  }

  let evento: ResendEvent;
  try {
    evento = JSON.parse(body) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Corpo non leggibile" }, { status: 400 });
  }

  const tipo = evento.type || "";
  const emailId = evento.data?.email_id;
  const destinatario = Array.isArray(evento.data?.to) ? evento.data?.to[0] : evento.data?.to;

  const lead =
    (emailId ? await prisma.lead.findFirst({ where: { emailId } }) : null) ??
    (destinatario
      ? await prisma.lead.findFirst({
          where: { email: destinatario.toLowerCase() },
          orderBy: { emailSentAt: "desc" },
        })
      : null);

  switch (tipo) {
    case "email.opened":
      if (lead && !lead.emailOpenedAt) {
        await prisma.lead.update({ where: { id: lead.id }, data: { emailOpenedAt: new Date() } });
      }
      await logEvent("email_opened", { leadId: lead?.id ?? null, channel: "email", detail: destinatario });
      break;

    case "email.bounced": {
      const permanente = (evento.data?.bounce?.type || "").toLowerCase() !== "transient";
      if (lead) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            emailBouncedAt: new Date(),
            ...(permanente ? { status: "skipped", outcome: "email inesistente" } : {}),
          },
        });
      }
      // Un rimbalzo permanente è un indirizzo morto: continuare a scriverci
      // peggiora solo la reputazione del mittente.
      if (permanente && destinatario) await addSuppression(destinatario, "email", "bounce");
      await logEvent("email_bounced", {
        leadId: lead?.id ?? null,
        channel: "email",
        detail: `${permanente ? "permanente" : "temporaneo"}: ${evento.data?.bounce?.message || destinatario || ""}`,
      });
      break;
    }

    case "email.complained":
      // Segnalazione come spam: si smette immediatamente, senza discutere.
      if (destinatario) await addSuppression(destinatario, "email", "reclamo");
      if (lead) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "skipped", outcome: "segnalato come spam" },
        });
        if (lead.phoneWa) await addSuppression(lead.phoneWa, "whatsapp", "reclamo");
      }
      await logEvent("email_complained", { leadId: lead?.id ?? null, channel: "email", detail: destinatario });
      break;

    default:
      // delivered, delivery_delayed, sent, clicked: utili nel registro, ma
      // non cambiano lo stato del lead.
      await logEvent("email_sent", {
        leadId: lead?.id ?? null,
        channel: "email",
        detail: `${tipo} ${destinatario || ""}`.trim(),
      });
  }

  return NextResponse.json({ ok: true });
}
