import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizePhotoUrl, sanitizePhotoList, photoProxyUrl, isValidPhotoRef, placesMediaUrl } from "./photos";

const REF = "places/ChIJ_abc-123/photos/AelY_CsdEF-gh12";

test("un URL media di Places con la chiave diventa un indirizzo del proxy", () => {
  const url = `https://places.googleapis.com/v1/${REF}/media?maxHeightPx=900&maxWidthPx=1600&key=AIzaSySEGRETA`;
  const clean = sanitizePhotoUrl(url);
  assert.ok(clean);
  assert.ok(!clean!.includes("AIzaSySEGRETA"), "la chiave non deve sopravvivere");
  assert.ok(clean!.startsWith("/api/photo?ref="));
  assert.ok(clean!.includes(encodeURIComponent(REF)));
});

test("le dimensioni richieste vengono conservate", () => {
  const url = `https://places.googleapis.com/v1/${REF}/media?maxHeightPx=400&maxWidthPx=800&key=k`;
  assert.ok(sanitizePhotoUrl(url)!.endsWith("&w=800&h=400"));
});

test("un indirizzo di Places non riconosciuto che porta una chiave viene scartato", () => {
  assert.equal(sanitizePhotoUrl("https://places.googleapis.com/v1/qualcosa/altro?key=AIza"), null);
});

test("un URL qualunque con parametro key perde solo la chiave", () => {
  const clean = sanitizePhotoUrl("https://esempio.it/foto.jpg?key=AIza&w=10");
  assert.equal(clean, "https://esempio.it/foto.jpg?w=10");
});

test("le foto dello scraper passano invariate", () => {
  const u = "https://lh3.googleusercontent.com/p/AF1Qip=w1600-h900";
  assert.equal(sanitizePhotoUrl(u), u);
});

test("un indirizzo già passato dal proxy resta com'e'", () => {
  const u = photoProxyUrl(REF);
  assert.equal(sanitizePhotoUrl(u), u);
});

test("stringhe vuote o rotte non producono foto", () => {
  assert.equal(sanitizePhotoUrl(""), null);
  assert.equal(sanitizePhotoUrl("   "), null);
  assert.equal(sanitizePhotoUrl("http://["), null);
});

test("la lista scarta i doppioni e le foto non recuperabili", () => {
  const list = sanitizePhotoList([
    `https://places.googleapis.com/v1/${REF}/media?key=a`,
    `https://places.googleapis.com/v1/${REF}/media?key=b`,
    "https://places.googleapis.com/v1/rotto?key=c",
    "",
  ]);
  assert.equal(list.length, 1);
});

test("il riferimento accettato dal proxy ha una forma sola", () => {
  assert.ok(isValidPhotoRef(REF));
  assert.ok(!isValidPhotoRef("places/x/photos/y/../../etc"));
  assert.ok(!isValidPhotoRef("https://altro.it/foto"));
  assert.ok(!isValidPhotoRef("places//photos/y"));
});

test("l'URL vero di Google si costruisce solo con la chiave a portata di mano", () => {
  const u = placesMediaUrl(REF, "AIza-segreta", 800, 600);
  assert.ok(u.startsWith("https://places.googleapis.com/v1/places/"));
  assert.ok(u.includes("key=AIza-segreta"));
});
