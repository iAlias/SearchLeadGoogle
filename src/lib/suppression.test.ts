// Solo la logica pura: normalizzare un contatto in modo che due modi diversi
// di scrivere la stessa email o lo stesso numero finiscano sulla stessa riga
// della lista degli esclusi. Chi si è disiscritto non deve poter essere
// ricontattato per un banale MAIUSC/minusc o per un "+39" scritto diverso.

import { test } from "node:test";
import assert from "node:assert";
import { normalizeContact } from "./suppression";

test("normalizza un'email in minuscolo, spazi tolti", () => {
  assert.equal(normalizeContact("  INFO@Aurora-Immobiliare.IT  ", "email"), "info@aurora-immobiliare.it");
});

test("normalizza un numero italiano con o senza prefisso allo stesso formato", () => {
  const attesa = "393331234567";
  assert.equal(normalizeContact("+39 333 1234567", "whatsapp"), attesa);
  assert.equal(normalizeContact("3331234567", "whatsapp"), attesa);
  assert.equal(normalizeContact("0039 333 1234567", "whatsapp"), attesa);
});

test("restituisce null per un contatto vuoto o non valido", () => {
  assert.equal(normalizeContact("", "email"), null);
  assert.equal(normalizeContact("   ", "whatsapp"), null);
  assert.equal(normalizeContact(null, "email"), null);
});

test("un'email senza @ non è un contatto valido", () => {
  assert.equal(normalizeContact("non-e-una-email", "email"), null);
});
