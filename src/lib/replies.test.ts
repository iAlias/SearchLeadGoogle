import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyReply, shouldSuppress } from "./replies";

test("le formule di rifiuto più comuni vengono riconosciute", () => {
  for (const msg of [
    "No grazie",
    "non mi interessa, grazie",
    "NON SIAMO INTERESSATI",
    "Cancellatemi da questa lista",
    "stop",
    "STOP.",
    "Basta messaggi per favore",
    "toglietemi dai vostri contatti",
    "questo è spam",
    "no",
  ]) {
    assert.equal(classifyReply(msg).kind, "rifiuto", msg);
  }
});

test("un rifiuto va sempre spento sul contatto, non solo annotato", () => {
  assert.equal(shouldSuppress(classifyReply("no grazie").kind), true);
  assert.equal(shouldSuppress(classifyReply("quanto costa?").kind), false);
});

test("i segnali di interesse vengono riconosciuti", () => {
  for (const msg of [
    "Buongiorno, quanto costa?",
    "mi interessa, mi chiami pure",
    "Vorrei maggiori informazioni sul sito",
    "Va bene, procediamo",
    "Come funziona esattamente?",
  ]) {
    assert.equal(classifyReply(msg).kind, "interesse", msg);
  }
});

test("in caso di dubbio il rifiuto vince sull'interesse", () => {
  assert.equal(classifyReply("non mi interessa sapere il prezzo").kind, "rifiuto");
  assert.equal(classifyReply("no grazie, quanto costa comunque?").kind, "rifiuto");
});

test("le parole corte non scattano dentro altre parole", () => {
  assert.notEqual(classifyReply("Siamo un negozio di stoppini").kind, "rifiuto");
  assert.notEqual(classifyReply("Il nostro indirizzo è via Nomentana").kind, "rifiuto");
  assert.notEqual(classifyReply("Abbiamo una bastarda scelta di vini").kind, "rifiuto");
});

test("gli accenti e la punteggiatura non cambiano l'esito", () => {
  assert.equal(classifyReply("Non è interessante: NON MI INTERESSA!!!").kind, "rifiuto");
  assert.equal(classifyReply("però mi interessa").kind, "interesse");
});

test("un messaggio qualunque non viene forzato in una categoria", () => {
  assert.equal(classifyReply("Buongiorno, chi parla?").kind, "altro");
  assert.equal(classifyReply("").kind, "altro");
  assert.equal(classifyReply("👍").kind, "altro");
});

test("l'espressione che ha deciso viene riportata", () => {
  assert.equal(classifyReply("no grazie").matched, "no grazie");
});
