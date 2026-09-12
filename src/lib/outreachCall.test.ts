import { test } from "node:test";
import assert from "node:assert/strict";
import { daRichiamare } from "./outreachPlan";

const ORA = new Date("2026-03-20T10:00:00Z");
const GIORNO = 24 * 60 * 60 * 1000;

test("chi ha ricevuto tutto e non risponde da abbastanza tempo va richiamato", () => {
  const lead = { status: "wa_sent", repliedAt: null, waSentAt: new Date(ORA.getTime() - 9 * GIORNO) };
  assert.equal(daRichiamare(lead, ORA, 4), true);
});

test("prima del tempo non si insiste", () => {
  const lead = { status: "wa_sent", repliedAt: null, waSentAt: new Date(ORA.getTime() - 3 * GIORNO) };
  assert.equal(daRichiamare(lead, ORA, 4), false);
});

test("chi ha risposto non finisce mai nella lista dei richiami", () => {
  const lead = {
    status: "wa_sent",
    repliedAt: new Date(ORA.getTime() - 5 * GIORNO),
    waSentAt: new Date(ORA.getTime() - 30 * GIORNO),
  };
  assert.equal(daRichiamare(lead, ORA, 4), false);
});

test("chi non ha ancora ricevuto il WhatsApp non c'entra", () => {
  assert.equal(daRichiamare({ status: "email_sent", repliedAt: null, waSentAt: null }, ORA, 4), false);
  assert.equal(daRichiamare({ status: "won", repliedAt: null, waSentAt: new Date(0) }, ORA, 4), false);
});

test("l'attesa non scende mai sotto una settimana, anche con follow-up brevissimi", () => {
  const dopoCinqueGiorni = { status: "wa_sent", repliedAt: null, waSentAt: new Date(ORA.getTime() - 5 * GIORNO) };
  assert.equal(daRichiamare(dopoCinqueGiorni, ORA, 1), false);
  const dopoOtto = { status: "wa_sent", repliedAt: null, waSentAt: new Date(ORA.getTime() - 8 * GIORNO) };
  assert.equal(daRichiamare(dopoOtto, ORA, 1), true);
});
