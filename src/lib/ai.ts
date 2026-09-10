import type { Category } from "./types";
import { CATEGORY_LABEL } from "./category";

// Genera 2-3 frasi di presentazione per la demo. Usa Anthropic se la chiave c'e,
// altrimenti restituisce un testo segnaposto credibile per categoria.

const FALLBACK: Record<Category, string> = {
  ristorante: "Cucina genuina e accoglienza familiare nel cuore della citta. Ingredienti freschi, piatti della tradizione e un'atmosfera dove sentirsi a casa.",
  bar: "Il punto di ritrovo del quartiere: colazioni, pause pranzo e aperitivi serviti con cura, dalla mattina presto fino a sera.",
  negozio: "Prodotti selezionati e consigli sinceri da chi conosce il mestiere. Un negozio di fiducia dove qualita e attenzione al cliente vengono prima di tutto.",
  parrucchiere: "Tagli, colore e cura dei capelli con la mano di professionisti che ascoltano. Esperienza, prodotti di qualita e risultati su misura per te.",
  estetista: "Trattamenti di bellezza e benessere in un ambiente curato e rilassante. Professionalita e attenzione ai dettagli per farti sentire al meglio.",
  // Testo neutro e informativo, senza superlativi ne offerte: la pubblicita
  // sanitaria e regolata dalla legge 145/2018.
  sanitario: "Visite e trattamenti seguiti con attenzione, in uno studio dove ogni persona viene ascoltata con calma. Prenotazione semplice, per telefono o messaggio.",
  studio_tecnico: "Consulenza chiara e affidabile, con pratiche seguite passo per passo. Un rapporto di fiducia costruito sulla competenza e sulla disponibilita a spiegare.",
  veterinario: "Cura e attenzione per ogni animale, dalla visita di controllo alle urgenze. Un ambulatorio dove il benessere del vostro animale viene prima di tutto.",
  officina: "Assistenza e riparazioni con tecnici esperti e preventivi onesti. La tua auto in mani sicure, con tempi rapidi e prezzi trasparenti.",
  hotel: "Ospitalita curata e camere accoglienti per un soggiorno sereno. Posizione comoda, servizi attenti e quel calore che fa la differenza.",
  generico: "Un'attivita del territorio che mette la qualita e il cliente al primo posto, con professionalita e passione di chi fa bene il proprio lavoro.",
};

export async function generateCopy(
  name: string,
  category: Category,
  city: string | null | undefined,
  reviewsText: string[]
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return FALLBACK[category];

  const model = process.env.AI_MODEL || "claude-haiku-4-5-20251001";
  const reviews = reviewsText.slice(0, 3).join(" / ").slice(0, 600);
  const prompt = `Scrivi 2-3 frasi (max 55 parole) di presentazione per il sito di questa attivita italiana.
Tono caldo, concreto, italiano corretto. Niente superlativi vuoti, niente "benvenuti nel nostro sito".
Attivita: ${name}
Tipo: ${CATEGORY_LABEL[category]}
Citta: ${city || "Italia"}
${reviews ? `Cosa dicono i clienti: ${reviews}` : ""}
Rispondi SOLO con il testo, senza virgolette ne preamboli.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return FALLBACK[category];
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.map((c) => c.text || "").join("").trim();
    return text || FALLBACK[category];
  } catch {
    return FALLBACK[category];
  }
}
