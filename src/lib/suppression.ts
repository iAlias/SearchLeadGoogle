// Lista di chi non vuole più essere contattato. Non è una funzione opzionale:
// senza questo, l'invio a freddo non ha una base giuridica difendibile
// (art. 21 GDPR, diritto di opposizione) e una richiesta di fermarsi che non
// viene onorata trasforma un contatto legittimo in spam.
//
// Vale per sempre e su tutti i canali insieme: chi si toglie dall'email non
// deve poi ritrovarsi contattato su WhatsApp con lo stesso numero, e viceversa.

import { prisma } from "./db";
import { normalizePhoneIt } from "./utils";

export type SuppressionChannel = "email" | "whatsapp";

// Porta email e numeri di telefono a una forma unica, così due modi diversi
// di scrivere lo stesso contatto (maiuscole, spazi, prefisso internazionale)
// finiscono sulla stessa riga della lista degli esclusi.
export function normalizeContact(
  raw: string | null | undefined,
  channel: SuppressionChannel
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (channel === "email") {
    const lower = trimmed.toLowerCase();
    return lower.includes("@") ? lower : null;
  }

  return normalizePhoneIt(trimmed);
}

export async function isSuppressed(
  raw: string | null | undefined,
  channel: SuppressionChannel
): Promise<boolean> {
  const contact = normalizeContact(raw, channel);
  if (!contact) return false;
  const hit = await prisma.suppression.findUnique({ where: { contact } });
  return !!hit;
}

export async function addSuppression(
  raw: string,
  channel: SuppressionChannel,
  reason: "richiesta" | "rifiuto" | "bounce" = "richiesta"
): Promise<void> {
  const contact = normalizeContact(raw, channel);
  if (!contact) return;
  await prisma.suppression.upsert({
    where: { contact },
    create: { contact, channel, reason },
    update: { reason },
  });
}
