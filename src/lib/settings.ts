import { prisma } from "./db";

// Sotto le 120 parole di proposito: chi la riceve ne legge dieci al giorno di
// venditori. L'unica cosa che la distingue e' che parla del loro sito, non
// del nostro prodotto - per questo il link alla demo viene prima del prezzo.
export const DEFAULT_EMAIL_BODY = `Buongiorno,

ho preparato una demo del sito di {{nome}}, con i vostri dati reali: foto, orari, recensioni Google. La trova qui, e gia pronta:
{{demo}}

Se le piace, lo mettiamo online sul vostro dominio in 48 ore. {{prezzo}}.

Se non le interessa, mi risponda "no grazie" e non la disturbo piu.

{{venditore}}`;

export const DEFAULT_WA_BODY = `Buongiorno! Le ho scritto qualche giorno fa per il sito di {{nome}}.
Le lascio il link diretto alla demo che ho preparato con i vostri dati reali:
{{demo}}

Sito completo online in 48h, {{prezzo}}. Se le interessa mi risponda qui 🙂
{{venditore}}`;

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (existing) {
    return {
      ...existing,
      emailFrom: existing.emailFrom || process.env.EMAIL_FROM || "",
      emailBody: existing.emailBody || DEFAULT_EMAIL_BODY,
      waBody: existing.waBody || DEFAULT_WA_BODY,
    };
  }
  return prisma.settings.create({
    data: {
      id: "singleton",
      emailFrom: process.env.EMAIL_FROM || "",
      emailBody: DEFAULT_EMAIL_BODY,
      waBody: DEFAULT_WA_BODY,
    },
  });
}

// Sostituisce i segnaposto {{nome}} {{demo}} {{prezzo}} {{venditore}} {{citta}}.
export function fillTemplate(
  tpl: string,
  vars: { nome: string; demo: string; prezzo: string; venditore: string; citta?: string }
): string {
  return tpl
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome)
    .replace(/\{\{\s*demo\s*\}\}/g, vars.demo)
    .replace(/\{\{\s*prezzo\s*\}\}/g, vars.prezzo)
    .replace(/\{\{\s*venditore\s*\}\}/g, vars.venditore)
    .replace(/\{\{\s*citta\s*\}\}/g, vars.citta || "");
}
