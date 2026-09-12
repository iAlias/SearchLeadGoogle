import { prisma } from "./db";

// Registro di cosa è stato fatto a chi. Il timestamp sul lead dice "l'email
// è partita il 3 marzo"; questo dice anche che il 5 è tornata indietro, che
// il 6 hanno risposto "no grazie" e che dal 6 il contatto è spento. Serve
// per rispondere a una contestazione e per capire dove si inceppa il flusso.

export type EventType =
  | "email_sent"
  | "email_opened"
  | "email_bounced"
  | "email_complained"
  | "wa_sent"
  | "replied"
  | "suppressed"
  | "skipped"
  | "demo_generated"
  | "error";

export async function logEvent(
  type: EventType,
  opts: { leadId?: string | null; channel?: "email" | "whatsapp" | null; detail?: string | null } = {}
): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        type,
        leadId: opts.leadId ?? null,
        channel: opts.channel ?? null,
        detail: opts.detail ? opts.detail.slice(0, 500) : null,
      },
    });
  } catch (e) {
    // Il registro non deve mai far fallire l'azione che sta registrando.
    console.error("logEvent:", (e as Error).message);
  }
}

export async function leadEvents(leadId: string, take = 30) {
  return prisma.event.findMany({ where: { leadId }, orderBy: { createdAt: "desc" }, take });
}
