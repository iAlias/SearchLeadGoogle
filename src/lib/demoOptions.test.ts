// Logica pura dietro il wizard di generazione demo: quali stili e sezioni
// esistono, come si abbrevia un nome troppo lungo, come si ricava un'intera
// palette da un solo colore scelto a mano, e dove porta il link "leggi le
// recensioni". Niente qui tocca il database o la rete.

import { test } from "node:test";
import assert from "node:assert";
import {
  DEMO_STYLES,
  DEMO_SECTIONS,
  DEFAULT_SECTION_KEYS,
  shortenSiteTitle,
  deriveShades,
  googleReviewsUrl,
  resolveSections,
} from "./demoOptions";

test("gli stili sono cinque, ognuno con una chiave unica", () => {
  assert.equal(DEMO_STYLES.length, 5);
  const chiavi = new Set(DEMO_STYLES.map((s) => s.key));
  assert.equal(chiavi.size, 5);
});

test("le sezioni sono almeno dieci, ognuna con una chiave unica", () => {
  assert.ok(DEMO_SECTIONS.length >= 10, `sono ${DEMO_SECTIONS.length}, ne servono almeno 10`);
  const chiavi = new Set(DEMO_SECTIONS.map((s) => s.key));
  assert.equal(chiavi.size, DEMO_SECTIONS.length);
});

test("un nome corto non viene toccato", () => {
  assert.equal(shortenSiteTitle("Studio Aurora", 42), "Studio Aurora");
});

test("un nome lungo con un trattino si accorcia al primo segmento", () => {
  const lungo = "Metodo Tamburo - Human Performance - Centro Fisioterapia Sicilia";
  assert.equal(shortenSiteTitle(lungo, 42), "Metodo Tamburo");
});

test("un nome lungo senza trattini si taglia a parole intere entro il limite", () => {
  const lungo = "Ambulatorio Veterinario Associato San Francesco di Bianchi e Rossi";
  const corto = shortenSiteTitle(lungo, 30);
  assert.ok(corto.length <= 30, `"${corto}" supera 30 caratteri`);
  assert.ok(!corto.endsWith(" "), "non deve finire con uno spazio");
  assert.ok(lungo.startsWith(corto.replace(/…$/, "").trim()));
});

test("deriva un'intera palette da un solo colore primario", () => {
  const p = deriveShades("#2F6F62");
  assert.equal(p.primary, "#2f6f62");
  assert.ok(/^#[0-9a-f]{6}$/.test(p.deep));
  assert.ok(/^#[0-9a-f]{6}$/.test(p.bg));
  assert.ok(/^#[0-9a-f]{6}$/.test(p.bg2));
  assert.ok(/^#[0-9a-f]{6}$/.test(p.ink));
  assert.ok(/^#[0-9a-f]{6}$/.test(p.accent));
});

test("il colore derivato 'deep' e' piu' scuro del primario", () => {
  const p = deriveShades("#2F6F62");
  const luma = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return (n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114;
  };
  assert.ok(luma(p.deep) < luma(p.primary));
});

test("con un placeId vero costruisce il link ufficiale alle recensioni", () => {
  const url = googleReviewsUrl({ placeId: "ChIJrTLr-GyuEmsRBfy61i59si0", name: "Studio Aurora", address: "Via Roma 1, Enna" });
  assert.ok(url.includes("ChIJrTLr-GyuEmsRBfy61i59si0"));
});

test("senza un placeId vero (sintetico o assente) usa una ricerca su Maps per nome e indirizzo", () => {
  const url1 = googleReviewsUrl({ placeId: "noid-abc-Studio Aurora-Via Roma 1", name: "Studio Aurora", address: "Via Roma 1, Enna" });
  const url2 = googleReviewsUrl({ placeId: null, name: "Studio Aurora", address: "Via Roma 1, Enna" });
  for (const url of [url1, url2]) {
    assert.ok(url.startsWith("https://www.google.com/maps/search/"));
    assert.ok(url.includes(encodeURIComponent("Studio Aurora")));
  }
});

test("senza scelta, le sezioni risolte sono quelle di sempre (compatibilita' con la generazione automatica)", () => {
  const risolte = resolveSections(undefined);
  assert.deepEqual([...risolte].sort(), [...DEFAULT_SECTION_KEYS].sort());
});

test("con una scelta esplicita, anche vuota, si rispetta quella", () => {
  assert.deepEqual([...resolveSections([])], []);
  assert.deepEqual([...resolveSections(["galleria", "chiSiamo"])].sort(), ["chiSiamo", "galleria"]);
});

test("una chiave di sezione sconosciuta viene ignorata, non inventata", () => {
  assert.deepEqual([...resolveSections(["chiSiamo", "sezione-che-non-esiste"])], ["chiSiamo"]);
});
