import { test } from "node:test";
import assert from "node:assert/strict";
import { planOutreach, type PlanInput, type PlanLead } from "./outreachPlan";

const ORA = new Date("2026-03-10T09:00:00Z");
const GIORNO = 24 * 60 * 60 * 1000;

function lead(patch: Partial<PlanLead> = {}): PlanLead {
  return {
    id: "l1",
    name: "Trattoria da Nino",
    email: "info@trattoria.it",
    phoneWa: "393471234567",
    status: "approved",
    outreachChannel: "email_and_wa",
    emailSentAt: null,
    waSentAt: null,
    repliedAt: null,
    ...patch,
  };
}

function input(patch: Partial<PlanInput> = {}): PlanInput {
  return {
    now: ORA,
    settings: { dailyEmailMax: 12, dailyWaMax: 20, waFollowupDays: 4 },
    emailsSentToday: 0,
    waSentToday: 0,
    leads: [lead()],
    suppressed: new Set<string>(),
    contacted: new Set<string>(),
    waReady: true,
    ...patch,
  };
}

test("un lead approvato con email riceve un'email, e nient'altro", () => {
  const { actions } = planOutreach(input());
  assert.equal(actions.length, 1);
  assert.equal(actions[0].channel, "email");
  assert.equal(actions[0].to, "info@trattoria.it");
});

test("un lead non approvato non viene contattato", () => {
  for (const status of ["scraped", "demo_ready", "skipped", "won", "lost"]) {
    assert.equal(planOutreach(input({ leads: [lead({ status })] })).actions.length, 0, status);
  }
});

test("chi si è disiscritto non riceve niente, su nessun canale", () => {
  const suppressed = new Set(["info@trattoria.it"]);
  const p = planOutreach(input({ suppressed }));
  assert.equal(p.actions.length, 0);
  assert.equal(p.skips[0].reason, "disiscritto");

  // e nemmeno il follow-up WhatsApp, che parte da un numero diverso
  const followup = planOutreach(
    input({
      suppressed,
      leads: [lead({ status: "email_sent", emailSentAt: new Date(ORA.getTime() - 10 * GIORNO) })],
    })
  );
  assert.equal(followup.actions.length, 0);
  assert.equal(followup.skips[0].reason, "disiscritto");
});

test("il numero disiscritto blocca il WhatsApp anche se l'email è pulita", () => {
  const p = planOutreach(
    input({
      suppressed: new Set(["393471234567"]),
      leads: [lead({ status: "approved", outreachChannel: "whatsapp_only", email: null })],
    })
  );
  assert.equal(p.actions.length, 0);
  assert.equal(p.skips[0].reason, "disiscritto");
});

test("chi ha già risposto non riceve il follow-up", () => {
  const p = planOutreach(
    input({
      leads: [
        lead({
          status: "email_sent",
          emailSentAt: new Date(ORA.getTime() - 10 * GIORNO),
          repliedAt: new Date(ORA.getTime() - 1 * GIORNO),
        }),
      ],
    })
  );
  assert.equal(p.actions.length, 0);
  assert.equal(p.skips[0].reason, "gia_risposto");
});

test("il follow-up WhatsApp parte solo dopo i giorni configurati", () => {
  const troppoPresto = planOutreach(
    input({ leads: [lead({ status: "email_sent", emailSentAt: new Date(ORA.getTime() - 3 * GIORNO) })] })
  );
  assert.equal(troppoPresto.actions.length, 0);

  const inTempo = planOutreach(
    input({ leads: [lead({ status: "email_sent", emailSentAt: new Date(ORA.getTime() - 4 * GIORNO) })] })
  );
  assert.equal(inTempo.actions.length, 1);
  assert.equal(inTempo.actions[0].channel, "whatsapp");
});

test("un lead senza email parte direttamente su WhatsApp", () => {
  const p = planOutreach(
    input({ leads: [lead({ email: null, outreachChannel: "whatsapp_only" })] })
  );
  assert.equal(p.actions.length, 1);
  assert.equal(p.actions[0].channel, "whatsapp");
});

test("senza WhatsApp collegato i messaggi non vengono pianificati, ma il motivo si vede", () => {
  const p = planOutreach(
    input({
      waReady: false,
      leads: [lead({ status: "email_sent", emailSentAt: new Date(ORA.getTime() - 9 * GIORNO) })],
    })
  );
  assert.equal(p.actions.length, 0);
  assert.equal(p.skips[0].reason, "whatsapp_offline");
});

test("il limite giornaliero tiene conto di quanto è già stato inviato oggi", () => {
  const tanti = Array.from({ length: 10 }, (_, i) =>
    lead({ id: `l${i}`, email: `info${i}@dominio.it`, phoneWa: `39347000000${i}` })
  );
  const p = planOutreach(input({ leads: tanti, emailsSentToday: 8, settings: { dailyEmailMax: 12, dailyWaMax: 20, waFollowupDays: 4 } }));
  const email = p.actions.filter((a) => a.channel === "email");
  assert.equal(email.length, 4, "12 al giorno meno 8 già inviate");
  assert.equal(p.skips.filter((s) => s.reason === "limite").length, 6);
});

test("un budget già esaurito non manda niente", () => {
  const p = planOutreach(input({ emailsSentToday: 99 }));
  assert.equal(p.actions.length, 0);
  assert.equal(p.skips[0].reason, "limite");
});

test("la stessa attività trovata in due ricerche riceve un solo messaggio", () => {
  const p = planOutreach(
    input({
      leads: [
        lead({ id: "a", email: "info@trattoria.it" }),
        lead({ id: "b", email: "INFO@Trattoria.it", phoneWa: "393479999999" }),
      ],
    })
  );
  assert.equal(p.actions.length, 1);
  assert.equal(p.actions[0].leadId, "a");
  assert.deepEqual(
    p.skips.map((s) => [s.leadId, s.reason]),
    [["b", "duplicato"]]
  );
});

test("un contatto già raggiunto in un giro precedente non viene ricontattato", () => {
  const p = planOutreach(input({ contacted: new Set(["info@trattoria.it"]) }));
  assert.equal(p.actions.length, 0);
  assert.equal(p.skips[0].reason, "duplicato");
});

test("email e WhatsApp hanno budget separati", () => {
  const p = planOutreach(
    input({
      emailsSentToday: 99,
      leads: [
        lead({ id: "a" }),
        lead({ id: "b", email: null, outreachChannel: "whatsapp_only", phoneWa: "393480000000" }),
      ],
    })
  );
  assert.equal(p.actions.length, 1);
  assert.equal(p.actions[0].channel, "whatsapp");
});

test("a un lead approvato con entrambi i canali si scrive prima l'email, non tutti e due insieme", () => {
  const p = planOutreach(input());
  assert.equal(p.actions.filter((a) => a.channel === "whatsapp").length, 0);
});

test("una email già inviata non viene rimandata", () => {
  const p = planOutreach(input({ leads: [lead({ emailSentAt: new Date(ORA.getTime() - 60 * GIORNO) })] }));
  assert.equal(p.actions.filter((a) => a.channel === "email").length, 0);
});

test("un WhatsApp già inviato non viene rimandato", () => {
  const p = planOutreach(
    input({
      leads: [
        lead({
          status: "email_sent",
          emailSentAt: new Date(ORA.getTime() - 30 * GIORNO),
          waSentAt: new Date(ORA.getTime() - 20 * GIORNO),
        }),
      ],
    })
  );
  assert.equal(p.actions.length, 0);
});

test("un'email scritta male non viene usata come indirizzo", () => {
  const p = planOutreach(input({ leads: [lead({ email: "non-e-una-email" })] }));
  assert.equal(p.actions.filter((a) => a.channel === "email").length, 0);
});
