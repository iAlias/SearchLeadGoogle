// Quanto vale un contatto, in un numero solo, calcolato una volta allo
// scraping. Serve a rispondere alla domanda pratica "chi chiamo per primo?".
//
// Prima l'ordinamento era alfabetico sullo stato del sito ("bad", "good",
// "none"): chi non aveva alcun sito - il prospetto più vendibile - finiva
// in fondo, dopo chi il sito ce l'ha già e buono. Questo punteggio mette
// l'ordine in una scala esplicita, così la lista si legge dall'alto.

export interface LeadScoreInput {
  websiteStatus: string; // none | bad | good
  reviewCount?: number | null;
  rating?: number | null;
  hasEmail?: boolean;
  hasPhone?: boolean;
  photoCount?: number;
}

export interface LeadScoreBreakdown {
  score: number;
  reasons: string[];
}

export function scoreLead(input: LeadScoreInput): LeadScoreBreakdown {
  const reasons: string[] = [];
  let score = 0;

  // 1. Il bisogno. È la ragione per cui lo stiamo contattando, quindi pesa
  //    più di tutto il resto messo insieme.
  if (input.websiteStatus === "none") {
    score += 50;
    reasons.push("non ha un sito");
  } else if (input.websiteStatus === "bad") {
    score += 38;
    reasons.push("ha un sito scadente");
  } else {
    reasons.push("ha già un sito che funziona");
  }

  // 2. La raggiungibilita'. Un lead perfetto che non si può contattare
  //    non è un lead: senza nessun canale il punteggio crolla.
  const canali = (input.hasEmail ? 1 : 0) + (input.hasPhone ? 1 : 0);
  if (input.hasEmail) {
    score += 16;
    reasons.push("ha un'email");
  }
  if (input.hasPhone) {
    score += 12;
    reasons.push("ha un numero");
  }
  if (canali === 0) {
    score -= 25;
    reasons.push("nessun modo di contattarla");
  }

  // 3. I segni di vita. Un'attività con molte recensioni recenti esiste
  //    davvero, ha clienti, e ha un motivo per curare la propria immagine.
  const recensioni = Math.max(0, input.reviewCount ?? 0);
  if (recensioni >= 200) {
    score += 16;
    reasons.push("molto conosciuta");
  } else if (recensioni >= 50) {
    score += 12;
    reasons.push("ben recensita");
  } else if (recensioni >= 10) {
    score += 7;
  } else if (recensioni === 0) {
    score -= 8;
    reasons.push("nessuna recensione: potrebbe essere chiusa");
  }

  // 4. La reputazione. Chi è già apprezzato compra più volentieri un sito
  //    che lo mostri; chi ha recensioni pessime ha un altro problema prima.
  const voto = input.rating ?? 0;
  if (voto >= 4.5) score += 6;
  else if (voto >= 4) score += 4;
  else if (voto > 0 && voto < 3) {
    score -= 6;
    reasons.push("recensioni negative");
  }

  // 5. Il materiale. Con tre foto la demo si vede bene; senza, è spoglia.
  if ((input.photoCount ?? 0) >= 3) score += 5;

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}
