import { NextRequest, NextResponse } from "next/server";
import { startOutreachRun, recoverStaleRuns } from "@/lib/jobs";
import { recoverStaleCampaigns } from "@/lib/scrape";
import { purgeOldData } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// L'ingresso automatico. Il follow-up "dopo quattro giorni" finora esisteva
// solo se qualcuno si ricordava di premere un pulsante il quarto giorno:
// così invece parte da solo.
//
// Da chiamare una o due volte al giorno, per esempio con l'Utilità di
// pianificazione di Windows o un cron:
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron
//
// Il segreto serve perché questa route resta raggiungibile anche quando
// l'app è protetta da password: senza, chiunque potrebbe far partire gli
// invii a orari a caso.

async function esegui(req: NextRequest) {
  const atteso = process.env.CRON_SECRET;
  if (!atteso) {
    return NextResponse.json({ error: "Cron non configurato: manca CRON_SECRET" }, { status: 503 });
  }

  const fornito = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret") || "";
  if (fornito !== atteso) {
    return NextResponse.json({ error: "Segreto non valido" }, { status: 401 });
  }

  const campagneRecuperate = await recoverStaleCampaigns();
  const giriRecuperati = await recoverStaleRuns();
  const pulizia = await purgeOldData();
  const invio = await startOutreachRun("cron");

  return NextResponse.json({
    ok: true,
    campagneRecuperate,
    giriRecuperati,
    pulizia,
    invio: { avviato: invio.started, id: invio.id, motivo: invio.reason },
  });
}

export async function POST(req: NextRequest) {
  return esegui(req);
}

// Comodo per i pianificatori che sanno fare solo una GET.
export async function GET(req: NextRequest) {
  return esegui(req);
}
