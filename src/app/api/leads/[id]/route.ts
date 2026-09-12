import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadEvents } from "@/lib/events";
import { addSuppression, isSuppressed } from "@/lib/suppression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  const [eventi, spentoEmail, spentoWa] = await Promise.all([
    leadEvents(id),
    isSuppressed(lead.email, "email"),
    isSuppressed(lead.phoneWa, "whatsapp"),
  ]);

  return NextResponse.json({ ...lead, eventi, suppressed: spentoEmail || spentoWa });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const allowed = ["name", "email", "phone", "status", "notes", "outcome", "city", "address"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  if (body.email !== undefined && body.emailSource === undefined) data.emailSource = "manual";

  const lead = await prisma.lead.update({ where: { id }, data });
  return NextResponse.json(lead);
}

// Spegne il contatto a mano: serve quando qualcuno chiede di non essere più
// disturbato per telefono o di persona, senza passare da un link.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (String(body.action) !== "suppress") {
    return NextResponse.json({ error: "Azione sconosciuta" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Non trovato" }, { status: 404 });

  if (lead.email) await addSuppression(lead.email, "email", "richiesta");
  if (lead.phoneWa) await addSuppression(lead.phoneWa, "whatsapp", "richiesta");
  await prisma.lead.update({ where: { id }, data: { status: "skipped", outcome: "disiscritto" } });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.lead.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
