import { NextResponse } from "next/server";
import { getCurrentRun, requestCancel, startOutreachRun } from "@/lib/jobs";
import { jsonParse } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializza(run: Awaited<ReturnType<typeof getCurrentRun>>) {
  if (!run) return null;
  return {
    id: run.id,
    state: run.state,
    trigger: run.trigger,
    emailsSent: run.emailsSent,
    waSent: run.waSent,
    skipped: run.skipped,
    queued: run.queued,
    planned: run.planned,
    currentLead: run.currentLead,
    errors: jsonParse<string[]>(run.errors, []),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

// Avvia il giro e torna subito: gli invii proseguono in background, la
// pagina segue l'avanzamento con la GET qui sotto.
export async function POST() {
  try {
    const res = await startOutreachRun("manuale");
    const run = await getCurrentRun();
    return NextResponse.json({ ok: res.started, reason: res.reason, run: serializza(run) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ run: serializza(await getCurrentRun()) });
}

export async function DELETE() {
  const fermato = await requestCancel();
  return NextResponse.json({ ok: fermato, run: serializza(await getCurrentRun()) });
}
