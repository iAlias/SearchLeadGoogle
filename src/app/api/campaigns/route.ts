import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runCampaign, recoverStaleCampaigns } from "@/lib/scrape";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Chi apre la lista è il primo ad accorgersi che una campagna è morta con
  // il server: qui la si chiude, invece di lasciarla girare per finta.
  await recoverStaleCampaigns();

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: true } } },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const businessType = String(body.businessType || "").trim();
  const location = String(body.location || "").trim();
  const engine = ["auto", "places", "scrape"].includes(body.engine) ? body.engine : "auto";
  const targetCount = Math.min(120, Math.max(10, Number(body.targetCount) || 60));

  if (!businessType || !location) {
    return NextResponse.json({ error: "Inserisci tipo attivita e luogo" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: `${businessType} · ${location}`,
      businessType,
      location,
      engine,
      targetCount,
      status: "pending",
    },
  });

  // Avvia lo scraping in background (non blocca la risposta).
  runCampaign(campaign.id).catch((e) => {
    console.error("runCampaign error:", e);
  });

  return NextResponse.json(campaign, { status: 201 });
}
