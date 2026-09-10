// Le tre categorie scelte nello studio di mercato (sanitari non medici,
// studi tecnici/legali, veterinari) sono quelle su cui vale la pena avere un
// template dedicato: sono le uniche per cui il cancello — un'email
// raggiungibile — regge quasi sempre. Questo test blocca la classificazione
// giusta prima che il resto (palette, testo, prezzo) sia costruito sopra.

import { test } from "node:test";
import assert from "node:assert";
import { detectCategory } from "./category";

test("un fisioterapista è un sanitario, non uno studio tecnico", () => {
  assert.equal(detectCategory("Studio di fisioterapia e riabilitazione"), "sanitario");
});

test("uno psicologo, un nutrizionista e un osteopata sono sanitari", () => {
  assert.equal(detectCategory("Psicologo psicoterapeuta"), "sanitario");
  assert.equal(detectCategory("Studio di nutrizione e dietetica"), "sanitario");
  assert.equal(detectCategory("Osteopata"), "sanitario");
});

test("un dentista è un sanitario", () => {
  assert.equal(detectCategory("Studio dentistico"), "sanitario");
});

test("un avvocato o un commercialista sono uno studio tecnico, non un sanitario", () => {
  assert.equal(detectCategory("Studio legale Rossi - avvocati"), "studio_tecnico");
  assert.equal(detectCategory("Studio commercialista e consulenza fiscale"), "studio_tecnico");
});

test("un geometra o un architetto sono uno studio tecnico", () => {
  assert.equal(detectCategory("Studio tecnico geometra"), "studio_tecnico");
  assert.equal(detectCategory("Architetto - progettazione"), "studio_tecnico");
});

test("un ambulatorio veterinario è la categoria veterinario, non sanitario", () => {
  assert.equal(detectCategory("Ambulatorio veterinario"), "veterinario");
  assert.equal(detectCategory("Clinica veterinaria Dr. Bianchi"), "veterinario");
});

test("le categorie esistenti restano quelle di prima", () => {
  assert.equal(detectCategory("Pizzeria da Mario"), "ristorante");
  assert.equal(detectCategory("Officina meccanica"), "officina");
  assert.equal(detectCategory("Attività senza indizi"), "generico");
});
