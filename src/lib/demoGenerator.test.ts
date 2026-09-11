// Protezione sui sei generatori di pagina: sono stringhe HTML costruite a
// mano, e un campo mancante si trasforma facilmente in un "undefined" o un
// "NaN" stampato nella demo che arriva al cliente.

import { test } from "node:test";
import assert from "node:assert";
import { generateDemoHtml, type DemoInput } from "./demoGenerator";
import { DEMO_STYLES, DEMO_SECTIONS } from "./demoOptions";

const BASE: DemoInput = {
  name: "Studio Aurora - Fisioterapia e Riabilitazione",
  category: "sanitario",
  city: "Enna",
  address: "Via Roma 1, 94100 Enna EN",
  phone: "0935 123456",
  placeId: null,
  rating: 4.6,
  reviewCount: 23,
  photos: ["https://esempio.it/1.jpg", "https://esempio.it/2.jpg", "https://esempio.it/3.jpg"],
  hours: [{ day: "Lunedì", hours: "9:00–13:00" }],
  topReviews: [{ author: "Anna", rating: 5, text: "Molto professionali." }],
  copy: "Visite e trattamenti seguiti con attenzione.",
  sellerName: "Chi vi scrive",
  sellerWa: null,
  priceLine: "149 euro",
  sections: DEMO_SECTIONS.map((s) => s.key),
};

for (const s of DEMO_STYLES) {
  test(`il tema ${s.key} produce un documento completo, senza undefined né NaN`, () => {
    const html = generateDemoHtml({ ...BASE, style: s.key });
    assert.ok(html.startsWith("<!doctype html>"));
    assert.ok(html.trim().endsWith("</html>"));
    assert.ok(!html.includes("undefined"), "c'è un undefined nella pagina");
    assert.ok(!html.includes("NaN"), "c'è un NaN nella pagina");
  });
}

test("Innovativo ha il suo motore, non ricade su un altro tema", () => {
  const html = generateDemoHtml({ ...BASE, style: "innovativo" as DemoInput["style"] });
  assert.ok(html.includes('id="xHero"'), "manca l'apertura con l'anello");
  assert.ok(html.includes("Anybody"), "manca il font variabile");
});
