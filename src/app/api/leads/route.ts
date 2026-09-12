import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGINA_MAX = 200;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const campaignId = sp.get("campaignId") || undefined;
  const status = sp.get("status") || undefined;
  const channel = sp.get("channel") || undefined;
  const onlyLeads = sp.get("onlyLeads"); // "1" → solo sito assente/scadente
  const q = (sp.get("q") || "").trim();
  const limit = Math.min(PAGINA_MAX, Math.max(1, Number(sp.get("limit")) || 50));
  const offset = Math.max(0, Number(sp.get("offset")) || 0);

  const where: Prisma.LeadWhereInput = {};
  if (campaignId) where.campaignId = campaignId;
  if (status) where.status = status;
  if (channel) where.outreachChannel = channel;
  if (onlyLeads === "1") where.websiteStatus = { in: ["none", "bad"] };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { city: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  // Dal più promettente in giù. L'ordinamento di prima era alfabetico sullo
  // stato del sito ("bad" < "good" < "none"), il che metteva in fondo
  // proprio chi un sito non ce l'ha — cioè il motivo per cui lo chiamiamo.
  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ leadScore: "desc" }, { reviewCount: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ items, total, limit, offset });
}

// Azioni bulk: approve / skip / reset / won / lost.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const action = String(body.action || "");
  if (!ids.length) return NextResponse.json({ error: "Nessun lead selezionato" }, { status: 400 });

  let data: Prisma.LeadUpdateManyMutationInput;
  if (action === "approve") data = { status: "approved" };
  else if (action === "skip") data = { status: "skipped" };
  else if (action === "reset") data = { status: "scraped", outcome: null };
  else if (action === "won") data = { status: "won", outcome: "won" };
  else if (action === "lost") data = { status: "lost", outcome: "lost" };
  else return NextResponse.json({ error: "Azione sconosciuta" }, { status: 400 });

  // Approvare un contatto che ha chiesto di non essere disturbato lo
  // rimetterebbe in coda: la disiscrizione vince sull'azione manuale.
  if (action === "approve") {
    const leads = await prisma.lead.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, phoneWa: true },
    });
    const contatti = leads.flatMap((l) => [l.email?.toLowerCase(), l.phoneWa].filter(Boolean) as string[]);
    const spenti = new Set(
      (await prisma.suppression.findMany({ where: { contact: { in: contatti } }, select: { contact: true } })).map(
        (s) => s.contact
      )
    );
    const ammessi = leads
      .filter((l) => !spenti.has((l.email || "").toLowerCase()) && !spenti.has(l.phoneWa || ""))
      .map((l) => l.id);

    const res = await prisma.lead.updateMany({ where: { id: { in: ammessi } }, data });
    return NextResponse.json({ ok: true, count: res.count, esclusi: ids.length - ammessi.length });
  }

  const res = await prisma.lead.updateMany({ where: { id: { in: ids } }, data });
  return NextResponse.json({ ok: true, count: res.count });
}
