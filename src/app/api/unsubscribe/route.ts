import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { addSuppression } from "@/lib/suppression";
import { getSettings } from "@/lib/settings";
import { readToken } from "@/lib/signing";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La disiscrizione ha due requisiti che si contraddicono solo in apparenza.
//
// 1. Deve bastare un clic, e deve funzionare senza account: chi ha ricevuto
//    l'email non ha e non deve avere un profilo qui dentro.
// 2. Non deve poter partire da sola. Prima era una GET su un indirizzo che
//    conteneva l'email in chiaro: qualunque scansione antivirus aziendale o
//    prefetch del client di posta poteva disiscrivere qualcuno che non aveva
//    cliccato niente, e chiunque poteva spegnere un indirizzo altrui
//    semplicemente scrivendolo nell'URL.
//
// Quindi: la GET mostra una pagina e non tocca nulla; è la POST a spegnere
// il contatto — che è anche quello che chiede la RFC 8058 per il pulsante
// "Annulla iscrizione" di Gmail e Outlook. Il link porta un gettone firmato,
// così l'indirizzo non è modificabile da chi lo riceve.

interface TokenPayload {
  e?: string;
  l?: string;
}

async function resolveTarget(req: NextRequest): Promise<{ email: string | null; leadId: string | null }> {
  const sp = req.nextUrl.searchParams;

  const token = sp.get("t");
  if (token) {
    const settings = await getSettings();
    const data = await readToken<TokenPayload>(settings.secret, token);
    if (data?.e) return { email: String(data.e), leadId: data.l ? String(data.l) : null };
    return { email: null, leadId: null };
  }

  // Link vecchi, già spediti prima che i gettoni esistessero: continuano a
  // funzionare. Chi ha ricevuto quella email non deve trovarsi davanti a un
  // link morto solo perché nel frattempo abbiamo cambiato il meccanismo.
  const legacy = sp.get("e");
  if (legacy && legacy.includes("@")) return { email: legacy, leadId: null };

  return { email: null, leadId: null };
}

export async function GET(req: NextRequest) {
  const { email } = await resolveTarget(req);
  if (!email) return page("Link non valido", "Questo link di disiscrizione non è valido o è incompleto.", null);

  const query = req.nextUrl.search;
  return page(
    "Vuole smettere di ricevere le nostre email?",
    `Confermando, l'indirizzo <b>${escapeHtml(email)}</b> non riceverà più nulla da noi, su nessun canale. La richiesta vale per sempre.`,
    query
  );
}

export async function POST(req: NextRequest) {
  const { email, leadId } = await resolveTarget(req);
  if (!email) return page("Link non valido", "Questo link di disiscrizione non è valido o è incompleto.", null);

  await addSuppression(email, "email", "richiesta");

  // La promessa è "non la disturbo più", non "non le mando più email":
  // spegniamo anche il numero WhatsApp della stessa attività, altrimenti chi
  // si toglie dalla posta si ritrova scritto sul telefono.
  const lead = leadId
    ? await prisma.lead.findUnique({ where: { id: leadId } })
    : await prisma.lead.findFirst({ where: { email: { equals: email } } });

  if (lead?.phoneWa) await addSuppression(lead.phoneWa, "whatsapp", "richiesta");
  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "skipped", outcome: "disiscritto" },
    });
  }

  await logEvent("suppressed", {
    leadId: lead?.id ?? null,
    channel: "email",
    detail: "disiscrizione richiesta dal destinatario",
  });

  return page(
    "Fatto.",
    "Non riceverà più nessuna email né messaggio da parte nostra. La richiesta resta valida per sempre.",
    null
  );
}

function page(titolo: string, testo: string, confirmQuery: string | null): Response {
  const form = confirmQuery
    ? `<form method="post" action="/api/unsubscribe${confirmQuery}" style="margin-top:26px">
         <button type="submit" style="background:#1f3a4d;color:#fff;border:0;border-radius:8px;padding:13px 26px;font:inherit;font-weight:600;cursor:pointer">Sì, non scrivetemi più</button>
       </form>`
    : "";

  return new Response(
    `<!doctype html><html lang="it"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>${escapeHtml(titolo)}</title></head>
     <body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#1f2937;text-align:center;line-height:1.6">
     <h1 style="font-size:1.3rem">${escapeHtml(titolo)}</h1>
     <p>${testo}</p>
     ${form}
     <p style="margin-top:34px"><a href="/privacy" style="color:#9ca3af;font-size:.85rem">Come trattiamo i suoi dati</a></p>
     </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
