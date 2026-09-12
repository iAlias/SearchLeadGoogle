import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreLead } from "./leadScore";

const base = { reviewCount: 40, rating: 4.4, hasEmail: true, hasPhone: true, photoCount: 4 };

test("chi non ha sito vale più di chi ha un sito scadente, che vale più di chi ce l'ha buono", () => {
  const senza = scoreLead({ ...base, websiteStatus: "none" }).score;
  const scadente = scoreLead({ ...base, websiteStatus: "bad" }).score;
  const buono = scoreLead({ ...base, websiteStatus: "good" }).score;
  assert.ok(senza > scadente, `${senza} > ${scadente}`);
  assert.ok(scadente > buono, `${scadente} > ${buono}`);
});

test("un lead senza alcun contatto finisce sotto uno contattabile con un sito buono", () => {
  const irraggiungibile = scoreLead({ ...base, websiteStatus: "none", hasEmail: false, hasPhone: false }).score;
  const contattabile = scoreLead({ ...base, websiteStatus: "good" }).score;
  assert.ok(irraggiungibile < contattabile, `${irraggiungibile} < ${contattabile}`);
});

test("l'email pesa più del solo numero di telefono", () => {
  const conEmail = scoreLead({ ...base, websiteStatus: "bad", hasPhone: false }).score;
  const soloTel = scoreLead({ ...base, websiteStatus: "bad", hasEmail: false }).score;
  assert.ok(conEmail > soloTel);
});

test("zero recensioni è un segnale di attività forse chiusa", () => {
  const zero = scoreLead({ ...base, websiteStatus: "none", reviewCount: 0 });
  const dieci = scoreLead({ ...base, websiteStatus: "none", reviewCount: 10 });
  assert.ok(zero.score < dieci.score);
  assert.ok(zero.reasons.some((r) => r.includes("chiusa")));
});

test("il punteggio resta nell'intervallo 0-100", () => {
  const max = scoreLead({ websiteStatus: "none", reviewCount: 5000, rating: 5, hasEmail: true, hasPhone: true, photoCount: 9 });
  const min = scoreLead({ websiteStatus: "good", reviewCount: 0, rating: 1, hasEmail: false, hasPhone: false, photoCount: 0 });
  assert.ok(max.score <= 100 && max.score > 80);
  assert.equal(min.score, 0);
});

test("i motivi spiegano in italiano perché quel punteggio", () => {
  const r = scoreLead({ ...base, websiteStatus: "none" }).reasons;
  assert.ok(r.includes("non ha un sito"));
  assert.ok(r.includes("ha un'email"));
});

test("i campi mancanti non fanno esplodere il calcolo", () => {
  const r = scoreLead({ websiteStatus: "bad" });
  assert.equal(typeof r.score, "number");
  assert.ok(Number.isFinite(r.score));
});
