import { prisma } from "./db";
import { runOutreach } from "./outreach";

// Un giro di invii dura molto più di una richiesta HTTP: fra due messaggi
// WhatsApp passano fino a novanta secondi, quindi venti messaggi sono venti
// minuti. Prima tutto questo stava dentro la POST che l'utente faceva
// cliccando "Lancia invio": la richiesta scadeva a metà, gli invii rimanenti
// non partivano e nessuno lo sapeva.
//
// Adesso la POST fa solo partire il giro e torna subito; lo stato vive su
// OutreachRun, la pagina lo interroga, e chi vuole può fermarlo.

const STALLO_MS = 5 * 60 * 1000;

const g = globalThis as unknown as { __outreachJob?: { runId: string | null } };
if (!g.__outreachJob) g.__outreachJob = { runId: null };
const job = g.__outreachJob;

export interface StartResult {
  id: string | null;
  started: boolean;
  reason?: string;
}

/**
 * Un giro alla volta. Due giri in parallelo si contenderebbero lo stesso
 * budget giornaliero e finirebbero per scrivere due volte alla stessa
 * persona.
 */
export async function startOutreachRun(trigger: "manuale" | "cron" = "manuale"): Promise<StartResult> {
  await recoverStaleRuns();

  const inCorso = await prisma.outreachRun.findFirst({ where: { state: "running" } });
  if (inCorso) {
    return { id: inCorso.id, started: false, reason: "Un invio è già in corso." };
  }

  const run = await prisma.outreachRun.create({
    data: { state: "running", trigger, heartbeatAt: new Date() },
  });
  job.runId = run.id;

  // Volutamente senza await: la richiesta che ha premuto il pulsante torna
  // subito, il giro continua per conto suo.
  void eseguiGiro(run.id);

  return { id: run.id, started: true };
}

async function eseguiGiro(runId: string): Promise<void> {
  const battito = setInterval(() => {
    prisma.outreachRun
      .update({ where: { id: runId }, data: { heartbeatAt: new Date() } })
      .catch(() => {});
  }, 20000);

  try {
    const res = await runOutreach(runId);
    await prisma.outreachRun.update({
      where: { id: runId },
      data: {
        state: res.cancelled ? "cancelled" : "done",
        emailsSent: res.emailsSent,
        waSent: res.waSent,
        skipped: res.skipped,
        queued: res.inCoda,
        planned: res.planned,
        errors: JSON.stringify(res.errors.slice(-20)),
        currentLead: null,
        finishedAt: new Date(),
        heartbeatAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.outreachRun
      .update({
        where: { id: runId },
        data: {
          state: "failed",
          errors: JSON.stringify([(e as Error).message]),
          currentLead: null,
          finishedAt: new Date(),
        },
      })
      .catch(() => {});
  } finally {
    clearInterval(battito);
    if (job.runId === runId) job.runId = null;
  }
}

export async function getCurrentRun() {
  await recoverStaleRuns();
  return prisma.outreachRun.findFirst({ orderBy: { startedAt: "desc" } });
}

export async function requestCancel(runId?: string): Promise<boolean> {
  const run = runId
    ? await prisma.outreachRun.findUnique({ where: { id: runId } })
    : await prisma.outreachRun.findFirst({ where: { state: "running" } });
  if (!run || run.state !== "running") return false;
  await prisma.outreachRun.update({ where: { id: run.id }, data: { cancelRequested: true } });
  return true;
}

/**
 * Un giro "in corso" che non dà segni di vita da cinque minuti non è in
 * corso: è un processo morto con il riavvio del server. Senza questo,
 * resterebbe lì per sempre a impedire ogni invio successivo.
 */
export async function recoverStaleRuns(): Promise<number> {
  const limite = new Date(Date.now() - STALLO_MS);
  const res = await prisma.outreachRun.updateMany({
    where: {
      state: "running",
      OR: [{ heartbeatAt: { lt: limite } }, { heartbeatAt: null, startedAt: { lt: limite } }],
    },
    data: {
      state: "failed",
      errors: JSON.stringify(["Interrotto: il server si è fermato durante l'invio."]),
      finishedAt: new Date(),
    },
  });
  return res.count;
}
