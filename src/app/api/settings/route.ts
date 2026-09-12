import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { hasEmailKey } from "@/lib/email";
import { hasPlacesKey } from "@/lib/places";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Il segreto con cui si firmano i link di disiscrizione non esce mai di qui:
// chi lo avesse potrebbe fabbricare link validi per indirizzi altrui.
function pubbliche<T extends { secret?: string }>(settings: T) {
  const { secret: _secret, ...resto } = settings;
  void _secret;
  return resto;
}

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    ...pubbliche(settings),
    // Cosa è configurato davvero, per dirlo nella pagina invece di
    // lasciare scoprire all'utente che le email erano finte.
    stato: {
      email: hasEmailKey(),
      places: hasPlacesKey(),
      ai: !!process.env.ANTHROPIC_API_KEY,
      webhook: !!process.env.RESEND_WEBHOOK_SECRET,
      cron: !!process.env.CRON_SECRET,
      password: !!process.env.APP_PASSWORD,
    },
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const allowed = [
    "sellerName", "sellerPhone", "sellerEmail", "emailFrom", "emailSubject", "emailBody",
    "waBody", "dailyEmailMax", "dailyWaMax", "waFollowupDays", "priceLine", "retentionDays",
  ];
  const numerici = ["dailyEmailMax", "dailyWaMax", "waFollowupDays", "retentionDays"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) {
      if (numerici.includes(k)) {
        // Sotto i trenta giorni la conservazione non sarebbe più una scelta
        // di privacy ma un modo per perdere il lavoro fatto.
        const min = k === "retentionDays" ? 30 : 0;
        data[k] = Math.max(min, Number(body[k]) || min);
      } else {
        data[k] = String(body[k] ?? "");
      }
    }
  }

  await getSettings(); // assicura che il singleton esista
  const settings = await prisma.settings.update({ where: { id: "singleton" }, data });
  return NextResponse.json(pubbliche(settings));
}
