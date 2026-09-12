import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runCampaign } from "@/lib/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { leads: true } } },
  });
  if (!campaign) return NextResponse.json({ error: "Non trovata" }, { status: 404 });
  return NextResponse.json(campaign);
}

// Rilancio della campagna, oppure richiesta di fermarla.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "rerun");

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Non trovata" }, { status: 404 });

  if (action === "cancel") {
    if (campaign.status !== "running") {
      return NextResponse.json({ error: "Questa ricerca non è in corso" }, { status: 400 });
    }
    // La ricerca si ferma al primo controllo utile: interrompere una fetch a
    // metà lascerebbe dati a pezzi.
    await prisma.campaign.update({ where: { id }, data: { cancelRequested: true } });
    return NextResponse.json({ ok: true });
  }

  if (campaign.status === "running") {
    return NextResponse.json({ error: "È già in corso" }, { status: 409 });
  }

  runCampaign(id).catch((e) => console.error("rerun error:", e));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.campaign.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
