// Chi viene contattato, su quale canale, in questo giro — e chi no, con il
// motivo. Nessun accesso al database e nessun invio: solo la decisione.
//
// Sta qui, separato dall'esecuzione, per una ragione pratica: è la parte in
// cui un errore si paga caro (una mail di troppo a chi si è disiscritto, un
// follow-up a chi ha già risposto, due messaggi alla stessa attività trovata
// in due ricerche diverse) ed è anche l'unica parte che si può verificare
// senza un server acceso, un WhatsApp collegato e una casella vera.

export type Channel = "email" | "whatsapp";

export interface PlanLead {
  id: string;
  name: string;
  email: string | null;
  phoneWa: string | null;
  status: string;
  outreachChannel: string;
  emailSentAt: Date | null;
  waSentAt: Date | null;
  repliedAt: Date | null;
}

export interface PlanSettings {
  dailyEmailMax: number;
  dailyWaMax: number;
  waFollowupDays: number;
}

export interface PlanInput {
  now: Date;
  settings: PlanSettings;
  emailsSentToday: number;
  waSentToday: number;
  leads: PlanLead[];
  /** Contatti spenti per sempre: email in minuscolo e numeri normalizzati. */
  suppressed: Set<string>;
  /**
   * Contatti già raggiunti da un altro lead (la stessa attività trovata in
   * due ricerche diverse è due righe nel database, ma una persona sola).
   */
  contacted: Set<string>;
  waReady: boolean;
}

export interface PlanAction {
  leadId: string;
  channel: Channel;
  to: string;
}

export interface PlanSkip {
  leadId: string;
  channel: Channel;
  /** Codice stabile, per decidere cosa fare; il testo lo mette chi lo mostra. */
  reason: "disiscritto" | "duplicato" | "limite" | "whatsapp_offline" | "gia_risposto";
}

export interface Plan {
  actions: PlanAction[];
  skips: PlanSkip[];
}

const GIORNO = 24 * 60 * 60 * 1000;

function normEmail(e: string | null): string | null {
  const v = (e || "").trim().toLowerCase();
  return v.includes("@") ? v : null;
}

export function planOutreach(input: PlanInput): Plan {
  const actions: PlanAction[] = [];
  const skips: PlanSkip[] = [];

  let budgetEmail = Math.max(0, input.settings.dailyEmailMax - input.emailsSentToday);
  let budgetWa = Math.max(0, input.settings.dailyWaMax - input.waSentToday);

  // I contatti già usati in questo stesso giro contano come contattati: due
  // lead con la stessa email non devono ricevere due messaggi oggi solo
  // perché nessuno dei due era ancora partito quando abbiamo deciso.
  const usati = new Set(input.contacted);

  // ── 1. Email ai lead approvati ───────────────────────────────────────
  for (const lead of input.leads) {
    const email = normEmail(lead.email);
    if (!email) continue;
    if (lead.status !== "approved") continue;
    if (lead.emailSentAt) continue;

    if (lead.repliedAt) {
      skips.push({ leadId: lead.id, channel: "email", reason: "gia_risposto" });
      continue;
    }
    if (input.suppressed.has(email)) {
      skips.push({ leadId: lead.id, channel: "email", reason: "disiscritto" });
      continue;
    }
    if (usati.has(email)) {
      skips.push({ leadId: lead.id, channel: "email", reason: "duplicato" });
      continue;
    }
    if (budgetEmail <= 0) {
      skips.push({ leadId: lead.id, channel: "email", reason: "limite" });
      continue;
    }

    actions.push({ leadId: lead.id, channel: "email", to: email });
    usati.add(email);
    budgetEmail--;
  }

  // ── 2. WhatsApp: follow-up e lead senza email ────────────────────────
  for (const lead of input.leads) {
    const numero = lead.phoneWa;
    if (!numero) continue;
    if (lead.waSentAt) continue;

    const followup =
      lead.status === "email_sent" &&
      !!lead.emailSentAt &&
      input.now.getTime() - lead.emailSentAt.getTime() >= input.settings.waFollowupDays * GIORNO;
    const soloWhatsapp = lead.status === "approved" && lead.outreachChannel === "whatsapp_only";
    if (!followup && !soloWhatsapp) continue;

    // Chi ha risposto non riceve il seguito: è la differenza fra un
    // promemoria e un assillo.
    if (lead.repliedAt) {
      skips.push({ leadId: lead.id, channel: "whatsapp", reason: "gia_risposto" });
      continue;
    }
    // La disiscrizione vale su tutti i canali insieme: chi si toglie
    // dall'email non deve ritrovarsi scritto su WhatsApp.
    const email = normEmail(lead.email);
    if (input.suppressed.has(numero) || (email && input.suppressed.has(email))) {
      skips.push({ leadId: lead.id, channel: "whatsapp", reason: "disiscritto" });
      continue;
    }
    if (!input.waReady) {
      skips.push({ leadId: lead.id, channel: "whatsapp", reason: "whatsapp_offline" });
      continue;
    }
    if (usati.has(numero)) {
      skips.push({ leadId: lead.id, channel: "whatsapp", reason: "duplicato" });
      continue;
    }
    if (budgetWa <= 0) {
      skips.push({ leadId: lead.id, channel: "whatsapp", reason: "limite" });
      continue;
    }

    actions.push({ leadId: lead.id, channel: "whatsapp", to: numero });
    usati.add(numero);
    budgetWa--;
  }

  return { actions, skips };
}

/** Etichette in italiano per il registro e per la pagina dei lead. */
export const SKIP_LABEL: Record<PlanSkip["reason"], string> = {
  disiscritto: "ha chiesto di non essere più contattato",
  duplicato: "stesso contatto già raggiunto da un altro lead",
  limite: "limite giornaliero raggiunto",
  whatsapp_offline: "WhatsApp non collegato",
  gia_risposto: "ha già risposto",
};

// Chi va richiamato: ha ricevuto email e WhatsApp, non ha mai risposto, ed è
// passato abbastanza tempo perché un terzo messaggio scritto diventi
// insistenza. A quel punto o si telefona o si lascia perdere: in entrambi i
// casi la decisione è di una persona, non di un automatismo — per questo qui
// si cambia solo lo stato, senza mandare niente.
export function daRichiamare(
  lead: { waSentAt: Date | null; repliedAt: Date | null; status: string },
  now: Date,
  giorniFollowup: number
): boolean {
  if (lead.status !== "wa_sent" || lead.repliedAt || !lead.waSentAt) return false;
  const attesa = Math.max(7, giorniFollowup * 2) * 24 * 60 * 60 * 1000;
  return now.getTime() - lead.waSentAt.getTime() >= attesa;
}
