import { prisma } from "./db";
import { addSuppression } from "./suppression";
import { classifyReply, shouldSuppress } from "./replies";
import { logEvent } from "./events";

// Cosa succede quando qualcuno risponde. È la metà mancante del giro: finora
// i messaggi partivano e basta, e il sistema non sapeva distinguere chi
// aveva risposto "no grazie" da chi non aveva mai aperto l'email. Risultato:
// il follow-up partiva lo stesso, e la frase "mi risponda e non la disturbo
// più" era una promessa che non potevamo mantenere.

export interface InboundMessage {
  /** Numero già normalizzato (39xxxxxxxxxx) oppure indirizzo email. */
  from: string;
  channel: "whatsapp" | "email";
  text: string;
}

export interface InboundResult {
  leadId: string | null;
  kind: ReturnType<typeof classifyReply>["kind"];
  suppressed: boolean;
}

export async function handleInbound(msg: InboundMessage): Promise<InboundResult> {
  const classificazione = classifyReply(msg.text);
  const spegni = shouldSuppress(classificazione.kind);

  const lead =
    msg.channel === "whatsapp"
      ? await prisma.lead.findFirst({ where: { phoneWa: msg.from }, orderBy: { waSentAt: "desc" } })
      : await prisma.lead.findFirst({
          where: { email: msg.from.toLowerCase() },
          orderBy: { emailSentAt: "desc" },
        });

  if (spegni) {
    await addSuppression(msg.from, msg.channel, "rifiuto");
    // Il rifiuto vale su tutti i canali: chi dice no su WhatsApp non deve
    // ricevere l'email della prossima campagna.
    if (lead?.email && msg.channel === "whatsapp") await addSuppression(lead.email, "email", "rifiuto");
    if (lead?.phoneWa && msg.channel === "email") await addSuppression(lead.phoneWa, "whatsapp", "rifiuto");
  }

  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        repliedAt: lead.repliedAt ?? new Date(),
        repliedVia: msg.channel,
        replyText: msg.text.slice(0, 1000),
        status: spegni ? "skipped" : lead.status === "won" ? "won" : "replied",
        outcome: spegni ? "rifiuto" : lead.outcome,
      },
    });
  }

  await logEvent(spegni ? "suppressed" : "replied", {
    leadId: lead?.id ?? null,
    channel: msg.channel,
    detail: `${classificazione.kind}${classificazione.matched ? ` ("${classificazione.matched}")` : ""}: ${msg.text.slice(0, 160)}`,
  });

  return { leadId: lead?.id ?? null, kind: classificazione.kind, suppressed: spegni };
}
