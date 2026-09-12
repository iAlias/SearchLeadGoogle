import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeWebsite } from "./websiteCheck";

const corpo = "<p>Cucina siciliana, pesce fresco tutti i giorni, prenotazioni al numero in alto.</p>".repeat(60);
const paginaSana = `<!doctype html><html><head><title>Trattoria da Nino</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${corpo}</body></html>`;

test("un sito curato è promosso", () => {
  const j = judgeWebsite({ url: "https://esempio.it", reachable: true, httpStatus: 200, html: paginaSana });
  assert.equal(j.status, "good");
});

test("il solo meta viewport mancante non basta più a bocciare", () => {
  const senzaViewport = paginaSana.replace(/<meta name="viewport"[^>]*>/, "");
  const j = judgeWebsite({ url: "https://esempio.it", reachable: true, httpStatus: 200, html: senzaViewport });
  assert.equal(j.status, "good", "un solo segnale debole non è una condanna");
  assert.ok(j.reasons.some((r) => r.includes("telefono")), "il segnale resta comunque annotato");
});

test("viewport mancante più assenza di HTTPS invece bocciano", () => {
  const senzaViewport = paginaSana.replace(/<meta name="viewport"[^>]*>/, "");
  const j = judgeWebsite({
    url: "http://esempio.it",
    reachable: true,
    httpStatus: 200,
    html: senzaViewport,
    finalUrl: "http://esempio.it",
  });
  assert.equal(j.status, "bad");
});

test("una pagina che non risponde è un'opportunità", () => {
  const j = judgeWebsite({ url: "https://esempio.it", reachable: false });
  assert.equal(j.status, "bad");
  assert.match(j.reasons[0], /non risponde/);
});

test("un errore HTTP viene riportato con il suo codice", () => {
  const j = judgeWebsite({ url: "https://esempio.it", reachable: true, httpStatus: 404 });
  assert.equal(j.status, "bad");
  assert.match(j.reasons[0], /404/);
});

test("la pagina predefinita del server non è un sito", () => {
  const j = judgeWebsite({
    url: "https://esempio.it",
    reachable: true,
    httpStatus: 200,
    html: "<html><body>Welcome to nginx!</body></html>",
  });
  assert.equal(j.status, "bad");
});

test("una pagina vuota è bocciata", () => {
  const j = judgeWebsite({ url: "https://esempio.it", reachable: true, httpStatus: 200, html: "<html></html>" });
  assert.equal(j.status, "bad");
});

test("un sito fermo da anni viene riconosciuto", () => {
  const vecchio = paginaSana.replace("</body>", "<footer>&copy; 2011 Trattoria da Nino</footer></body>");
  const j = judgeWebsite({ url: "https://esempio.it", reachable: true, httpStatus: 200, html: vecchio });
  assert.ok(j.reasons.some((r) => r.includes("2011")));
});

test("i frame fanno scattare la bocciatura", () => {
  const html = `<html><head><title>x</title><meta name="viewport" content="width=device-width"></head><frameset><frame src="a.html"></frameset>${corpo}</html>`;
  const j = judgeWebsite({ url: "https://esempio.it", reachable: true, httpStatus: 200, html });
  assert.equal(j.status, "bad");
});

test("una pagina in costruzione è sempre bocciata", () => {
  const html = `<html><head><title>x</title><meta name="viewport" content="width=device-width"></head><body>${"<p>Sito in costruzione, torna presto.</p>".repeat(80)}</body></html>`;
  const j = judgeWebsite({ url: "https://esempio.it", reachable: true, httpStatus: 200, html });
  assert.equal(j.status, "bad");
});
