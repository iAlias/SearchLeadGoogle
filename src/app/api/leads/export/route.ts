import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/settings";
import { jsonParse } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId") || undefined;
  const leads = await prisma.lead.findMany({
    where: campaignId ? { campaignId } : {},
    orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
  });

  const headers = [
    "punti", "nome", "categoria", "citta", "indirizzo", "telefono", "email", "fonte_email",
    "sito", "stato_sito", "perche_lead", "rating", "recensioni", "canale", "stato",
    "email_inviata", "email_aperta", "whatsapp_inviato", "ha_risposto", "risposta", "demo",
  ];
  const base = appUrl();

  const rows = leads.map((l) =>
    [
      l.leadScore,
      l.name, l.category, l.city, l.address, l.phone, l.email, l.emailSource,
      l.website, l.websiteStatus, jsonParse<string[]>(l.websiteReasons, []).join(" · "),
      l.rating, l.reviewCount, l.outreachChannel, l.status,
      iso(l.emailSentAt), iso(l.emailOpenedAt), iso(l.waSentAt), iso(l.repliedAt), l.replyText,
      l.demoSlug ? `${base}/demo/${l.demoSlug}` : "",
    ].map(csvCell).join(";")
  );

  const csv = "﻿" + [headers.join(";"), ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads.csv"`,
    },
  });
}

function iso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace("T", " ") : "";
}
