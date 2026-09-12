import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [campaigns, total, byStatus, withEmail, withPhone, opened, replied, won, suppressed] = await Promise.all([
    prisma.campaign.count(),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.count({ where: { email: { not: null } } }),
    prisma.lead.count({ where: { phoneWa: { not: null } } }),
    prisma.lead.count({ where: { emailOpenedAt: { not: null } } }),
    prisma.lead.count({ where: { repliedAt: { not: null } } }),
    prisma.lead.count({ where: { outcome: "won" } }),
    prisma.suppression.count(),
  ]);

  const statusMap: Record<string, number> = {};
  for (const s of byStatus) statusMap[s.status] = s._count;

  // Contattati davvero: chi ha ricevuto almeno un messaggio, qualunque cosa
  // sia successa dopo.
  const emailSent = await prisma.lead.count({
    where: { OR: [{ emailSentAt: { not: null } }, { waSentAt: { not: null } }] },
  });

  return NextResponse.json({
    campaigns,
    total,
    withEmail,
    withPhone,
    opened,
    replied,
    won,
    suppressed,
    emailSent,
    statusMap,
  });
}
